"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { autoPriceCourseMode, autoPricePackageMode, autoPriceTierMode, getChargeCadence } from "./pricing";
import { computePaymentBreakdown, type PaymentInput } from "./billing";
import { loadPaymentConfig, loadInvoiceForVisit } from "./data";
import { buildInvoiceEmailHtml } from "./invoiceEmailHtml";
import { getResendClient, RESEND_FROM_EMAIL } from "@/lib/email/resend";

export type ProfileFormFields = {
  firstName: string;
  lastName: string;
  certificationLevel: string;
  loggedDives: number;
  nitroxCertified: boolean;
  email: string;
  whatsapp: string;
  accommodation: string;
  foodAllergies: string;
  hasDiveInsurance: boolean | null;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  emergencyContactWhatsapp: string;
  emergencyContactEmail: string;
};

export async function saveDiverProfile(
  diverId: string,
  fields: ProfileFormFields,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("divers")
    .update({
      first_name: fields.firstName.trim(),
      last_name: fields.lastName.trim(),
      certification_level: fields.certificationLevel,
      logged_dives: fields.loggedDives,
      nitrox_certified: fields.nitroxCertified,
      email: fields.email.trim() || null,
      whatsapp: fields.whatsapp.trim() || null,
      accommodation: fields.accommodation.trim() || null,
      food_allergies: fields.foodAllergies.trim() || null,
      has_dive_insurance: fields.hasDiveInsurance,
      insurance_provider: fields.hasDiveInsurance ? fields.insuranceProvider.trim() || null : null,
      insurance_policy_number: fields.hasDiveInsurance ? fields.insurancePolicyNumber.trim() || null : null,
      emergency_contact_name: fields.emergencyContactName.trim() || null,
      emergency_contact_phone: fields.emergencyContactPhone.trim() || null,
      emergency_contact_relationship: fields.emergencyContactRelationship.trim() || null,
      emergency_contact_whatsapp: fields.emergencyContactWhatsapp.trim() || null,
      emergency_contact_email: fields.emergencyContactEmail.trim() || null,
    })
    .eq("id", diverId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

// Standardized on the at/by pair, not the plain `medical_acknowledged`
// boolean also present on this table — see the plan's medical-ack decision.
export async function acknowledgeMedical(diverId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("divers")
    .update({
      medical_acknowledged_at: new Date().toISOString(),
      medical_acknowledged_by: user.id,
    })
    .eq("id", diverId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

export async function getCertCardSignedUrl(certCardPath: string): Promise<{ url?: string; error?: string }> {
  await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase.storage.from("cert-cards").createSignedUrl(certCardPath, 300);

  if (error || !data) return { error: error?.message ?? "Could not load cert card." };
  return { url: data.signedUrl };
}

// ── Notes ────────────────────────────────────────────────────────────────

export async function addDiverNote(diverId: string, note: string): Promise<{ error?: string }> {
  const trimmed = note.trim();
  if (!trimmed) return { error: "Note cannot be empty." };

  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase.from("diver_notes").insert({
    dive_center_id: user.diveCenterId,
    diver_id: diverId,
    note: trimmed,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

// RLS already restricts this to owners (diver_notes_delete_owner) — the
// client only renders the button for owners too, but the real gate is here.
export async function deleteDiverNote(diverId: string, noteId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("diver_notes")
    .delete()
    .eq("id", noteId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

// ── Equipment ────────────────────────────────────────────────────────────
//
// equipment_requested's real shape is { items: {name, size|null, kg?}[],
// computer: boolean } — confirmed from the actual payload
// RegistrationWizard.tsx sends today, not the old app's diver-form.html
// shape (which uses a different, no-longer-relevant {type, items}
// structure). The weights item carries kg instead of size.
export type EquipmentSelection = {
  needsEquipment: boolean;
  items: { name: string; size: string | null; kg?: number | null }[];
  computer: boolean;
};

export async function saveDiverEquipment(
  diverId: string,
  selection: EquipmentSelection,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("divers")
    .update({
      needs_equipment: selection.needsEquipment,
      equipment_requested: JSON.stringify({ items: selection.items, computer: selection.computer }),
    })
    .eq("id", diverId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  // Known gap, not silently swallowed: neither this save nor the pricing
  // engine's Auto-Price (pricing.ts) computes activities.equipment_rental
  // from a diver's saved equipment selection — Auto-Price only fills
  // dive_rate/fuel/marine/shark/nitrox/15L. Equipment rental stays a plain
  // manual-entry number on the activity row for now. Matching
  // equipment_requested items against equipment_rental_rates (by name +
  // per_dive/per_day cadence, same shape as the other_charges lookups
  // already built) is real, scoped-out follow-up work, not done here.
  revalidatePath(`/divers/${diverId}`);
  return {};
}

// ── Visits + Activities ─────────────────────────────────────────────────

export async function createVisit(
  diverId: string,
  experienceType: "fun_diving" | "dive_course",
  courseRateId: string | null,
): Promise<{ error?: string; visitId?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("visits")
    .insert({
      dive_center_id: user.diveCenterId,
      diver_id: diverId,
      experience_type: experienceType,
      course_rate_id: experienceType === "dive_course" ? courseRateId : null,
      visit_status: "open",
      is_active: true,
      is_paid: false,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return { visitId: data.id };
}

export async function addActivityRow(
  diverId: string,
  visitId: string,
  date: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase.from("activities").insert({
    dive_center_id: user.diveCenterId,
    diver_id: diverId,
    visit_id: visitId,
    date,
    status: "planned",
  });

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

export type ActivityFields = {
  date: string;
  diveSite: string;
  staffName: string;
  diveRate: number;
  fuelSurcharge: number;
  marineTax: number;
  sharkFee: number;
  nitroxFee: number;
  fifteenLFee: number;
  equipmentRental: number;
  addons: number;
  discount: number;
  status: "planned" | "scheduled" | "ongoing" | "completed" | "cancelled";
};

export async function saveActivityRow(
  diverId: string,
  activityId: string,
  fields: ActivityFields,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("activities")
    .update({
      date: fields.date,
      dive_site: fields.diveSite.trim() || null,
      staff_name: fields.staffName.trim() || null,
      dive_rate: fields.diveRate,
      fuel_surcharge: fields.fuelSurcharge,
      marine_tax: fields.marineTax,
      shark_fee: fields.sharkFee,
      nitrox_fee: fields.nitroxFee,
      fifteen_l_fee: fields.fifteenLFee,
      equipment_rental: fields.equipmentRental,
      addons: fields.addons,
      discount: fields.discount,
      status: fields.status,
    })
    .eq("id", activityId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

export async function deleteActivityRow(diverId: string, activityId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

export type AutoPriceRequest = {
  visitId: string;
  activityId: string;
  date: string;
  diveSite: string;
  wantsNitrox: boolean;
  wants15L: boolean;
};

export async function autoPriceActivityRow(
  request: AutoPriceRequest,
): Promise<{
  error?: string;
  note?: string | null;
  diveRate?: number;
  fuelSurcharge?: number;
  marineTax?: number;
  sharkFee?: number;
  nitroxFee?: number;
  fifteenLFee?: number;
}> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: visit }, { data: dc }, { data: siblingsRaw }] = await Promise.all([
    supabase
      .from("visits")
      .select("experience_type, course_rate_id")
      .eq("id", request.visitId)
      .eq("dive_center_id", user.diveCenterId)
      .single(),
    supabase.from("dive_centers").select("pricing_mode").eq("id", user.diveCenterId).single(),
    supabase
      .from("activities")
      .select("id, date, status, fuel_surcharge, marine_tax, shark_fee")
      .eq("visit_id", request.visitId)
      .neq("status", "cancelled"),
  ]);

  if (!visit) return { error: "Visit not found." };

  const siblings = (siblingsRaw ?? []).filter((a) => a.id !== request.activityId);
  const cumulativeDiveCount = (siblingsRaw ?? []).length; // includes this row if already non-cancelled

  let result;
  if (visit.experience_type === "dive_course") {
    result = await autoPriceCourseMode(user.diveCenterId, visit.course_rate_id);
  } else if (dc?.pricing_mode === "package") {
    result = await autoPricePackageMode(user.diveCenterId, request.diveSite);
  } else if (dc?.pricing_mode === "tier") {
    result = await autoPriceTierMode(
      user.diveCenterId,
      request.diveSite,
      Math.max(1, cumulativeDiveCount),
      request.wantsNitrox,
      request.wants15L,
    );
  } else {
    return { error: "This dive center has no pricing mode configured yet (see Settings > Pricing & Rates)." };
  }

  // Per-day cadence: zero out a charge if an earlier row already carries it
  // for the same calendar date and that charge is configured as per_day.
  if (visit.experience_type !== "dive_course") {
    const cadence = await getChargeCadence(user.diveCenterId);
    const sameDaySiblings = siblings.filter((s) => s.date === request.date);
    if (cadence.marineTax === "per_day" && sameDaySiblings.some((s) => Number(s.marine_tax) > 0)) {
      result.marineTax = 0;
    }
    if (cadence.sharkFee === "per_day" && sameDaySiblings.some((s) => Number(s.shark_fee) > 0)) {
      result.sharkFee = 0;
    }
    // Fuel charge cadence looked up per matched level (medium/high) — since
    // the row's own resolved amount already picks the right level, checking
    // cadence for either fuel sub-type against a sibling's existing
    // fuel_surcharge is a reasonable proxy without re-resolving the sibling's
    // own site.
    if (
      (cadence.fuelMedium === "per_day" || cadence.fuelHigh === "per_day") &&
      sameDaySiblings.some((s) => Number(s.fuel_surcharge) > 0)
    ) {
      result.fuelSurcharge = 0;
    }
  }

  return {
    diveRate: result.diveRate,
    fuelSurcharge: result.fuelSurcharge,
    marineTax: result.marineTax,
    sharkFee: result.sharkFee,
    nitroxFee: result.nitroxFee,
    fifteenLFee: result.fifteenLFee,
    note: result.note,
  };
}

// Hard-delete, only when the visit has zero activities and zero payments —
// matches the live app's void-visit guard.
export async function voidVisit(diverId: string, visitId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ count: activityCount }, { count: paymentCount }] = await Promise.all([
    supabase.from("activities").select("id", { count: "exact", head: true }).eq("visit_id", visitId),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("visit_id", visitId),
  ]);

  if ((activityCount ?? 0) > 0 || (paymentCount ?? 0) > 0) {
    return { error: "Can't void a visit that already has activities or a payment on file." };
  }

  const { error } = await supabase
    .from("visits")
    .delete()
    .eq("id", visitId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

// ── Bill summary / payment (kept open — not checkout) ───────────────────

export async function savePaymentOnly(
  diverId: string,
  visitId: string,
  grandTotalPhp: number,
  depositsTotal: number,
  input: PaymentInput,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const config = await loadPaymentConfig(user.diveCenterId);
  const breakdown = computePaymentBreakdown(input, config.cardSurchargeRate, config.onlineSurchargeRate);
  const balance = Math.max(0, grandTotalPhp - input.discount - depositsTotal - breakdown.totalCollected);

  const { error } = await supabase.from("payments").upsert(
    {
      dive_center_id: user.diveCenterId,
      diver_id: diverId,
      visit_id: visitId,
      cash_amount: breakdown.cashAmount,
      cash_amount_foreign: breakdown.cashAmountForeign || null,
      cash_currency_code: breakdown.cashCurrencyCode,
      cash_exchange_rate: breakdown.cashExchangeRate || null,
      card_amount: breakdown.cardAmount,
      online_amount: breakdown.onlineAmount,
      total_paid: breakdown.totalCollected,
      balance,
      discount: input.discount,
      grand_total_php: grandTotalPhp,
      card_surcharge_rate: breakdown.cardSurchargeRate,
      online_surcharge_rate: breakdown.onlineSurchargeRate,
      card_surcharge_amount: breakdown.cardSurchargeAmount,
      online_surcharge_amount: breakdown.onlineSurchargeAmount,
      total_surcharge: breakdown.totalSurcharge,
      total_collected: breakdown.totalCollected,
      is_paid: false,
    },
    { onConflict: "visit_id" },
  );

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

export async function addDeposit(
  diverId: string,
  visitId: string,
  amount: number,
  method: "cash" | "card" | "online",
  receivedBy: string,
): Promise<{ error?: string }> {
  if (!(amount > 0)) return { error: "Deposit amount must be greater than 0." };

  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase.from("deposits").insert({
    dive_center_id: user.diveCenterId,
    diver_id: diverId,
    visit_id: visitId,
    amount,
    method,
    deposit_date: new Date().toISOString().slice(0, 10),
    received_by: receivedBy.trim() || null,
    recorded_by_user_id: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

// ── Checkout ─────────────────────────────────────────────────────────────
//
// Closes the bill for real: totals, payment record, invoice snapshot (what
// Billing Audit's Reports tab already reads). No email is sent here — that
// stays a separate, explicit, user-clicked action (sendInvoice below),
// matching this app's established anti-auto-trigger convention (no
// auto-print/auto-send anywhere else either).

export async function checkoutVisit(
  diverId: string,
  visitId: string,
  input: PaymentInput,
): Promise<{ error?: string; invoiceId?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: diver }, { data: activitiesRaw }, { data: depositsRaw }] = await Promise.all([
    supabase.from("divers").select("first_name, last_name, nationality").eq("id", diverId).single(),
    supabase
      .from("activities")
      .select(
        "date, dive_site, staff_name, dive_rate, fuel_surcharge, marine_tax, shark_fee, nitrox_fee, fifteen_l_fee, equipment_rental, addons, status",
      )
      .eq("visit_id", visitId),
    supabase.from("deposits").select("amount").eq("visit_id", visitId),
  ]);

  if (!diver) return { error: "Diver not found." };

  const activities = activitiesRaw ?? [];
  const stillOpen = activities.some((a) => a.status === "planned" || a.status === "scheduled" || a.status === "ongoing");
  if (stillOpen) {
    return { error: "Every activity must be completed or cancelled before checkout." };
  }
  if (activities.length === 0) {
    return { error: "Add at least one activity before checking out." };
  }

  const completed = activities.filter((a) => a.status !== "cancelled");
  const grandTotal = completed.reduce((s, a) => s + (Number(a.dive_rate) + Number(a.fuel_surcharge) + Number(a.marine_tax) + Number(a.shark_fee) + Number(a.nitrox_fee) + Number(a.fifteen_l_fee) + Number(a.equipment_rental) + Number(a.addons)), 0);
  const depositsTotal = (depositsRaw ?? []).reduce((s, d) => s + Number(d.amount), 0);

  const config = await loadPaymentConfig(user.diveCenterId);
  const breakdown = computePaymentBreakdown(input, config.cardSurchargeRate, config.onlineSurchargeRate);
  const balance = grandTotal - input.discount - depositsTotal - breakdown.totalCollected;

  if (balance > 0.01) {
    return { error: `Balance of ₱${Math.round(balance).toLocaleString()} still due — collect full payment before checkout.` };
  }

  const { error: visitError } = await supabase
    .from("visits")
    .update({
      is_paid: true,
      is_active: false,
      visit_end: new Date().toISOString().slice(0, 10),
      visit_status: "closed",
    })
    .eq("id", visitId)
    .eq("dive_center_id", user.diveCenterId);
  if (visitError) return { error: visitError.message };

  const { error: paymentError } = await supabase.from("payments").upsert(
    {
      dive_center_id: user.diveCenterId,
      diver_id: diverId,
      visit_id: visitId,
      cash_amount: breakdown.cashAmount,
      cash_amount_foreign: breakdown.cashAmountForeign || null,
      cash_currency_code: breakdown.cashCurrencyCode,
      cash_exchange_rate: breakdown.cashExchangeRate || null,
      card_amount: breakdown.cardAmount,
      online_amount: breakdown.onlineAmount,
      total_paid: breakdown.totalCollected,
      balance: Math.max(0, balance),
      discount: input.discount,
      grand_total_php: grandTotal,
      card_surcharge_rate: breakdown.cardSurchargeRate,
      online_surcharge_rate: breakdown.onlineSurchargeRate,
      card_surcharge_amount: breakdown.cardSurchargeAmount,
      online_surcharge_amount: breakdown.onlineSurchargeAmount,
      total_surcharge: breakdown.totalSurcharge,
      total_collected: breakdown.totalCollected,
      is_paid: true,
      paid_at: new Date().toISOString(),
    },
    { onConflict: "visit_id" },
  );
  if (paymentError) return { error: paymentError.message };

  const diverName = `${diver.first_name} ${diver.last_name}`;
  const snapshot = {
    diver_name: diverName,
    nationality: diver.nationality,
    activities: completed.map((a) => ({
      date: a.date,
      dive_site: a.dive_site,
      staff_name: a.staff_name,
      dive_rate: Number(a.dive_rate),
      fuel_surcharge: Number(a.fuel_surcharge),
      marine_tax: Number(a.marine_tax),
      shark_fee: Number(a.shark_fee),
      nitrox_fee: Number(a.nitrox_fee),
      fifteen_l_fee: Number(a.fifteen_l_fee),
      equipment_rental: Number(a.equipment_rental),
      addons: Number(a.addons),
      status: a.status,
    })),
    discount: input.discount,
    payment: {
      cash_amount: breakdown.cashAmount,
      cash_amount_foreign: breakdown.cashAmountForeign,
      cash_currency: breakdown.cashCurrencyCode,
      cash_exchange_rate: breakdown.cashExchangeRate,
      card_amount: breakdown.cardAmount,
      online_amount: breakdown.onlineAmount,
      card_surcharge_rate: breakdown.cardSurchargeRate,
      online_surcharge_rate: breakdown.onlineSurchargeRate,
      card_surcharge_amount: breakdown.cardSurchargeAmount,
      online_surcharge_amount: breakdown.onlineSurchargeAmount,
      total_surcharge: breakdown.totalSurcharge,
      total_collected: breakdown.totalCollected,
    },
    grand_total: grandTotal,
    total_collected: breakdown.totalCollected,
    closed_at: new Date().toISOString(),
    closed_by: user.fullName,
  };

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoice_emails")
    .insert({
      dive_center_id: user.diveCenterId,
      diver_id: diverId,
      visit_id: visitId,
      invoice_snapshot: snapshot,
      sent_by: user.id,
    })
    .select("id")
    .single();
  if (invoiceError) return { error: invoiceError.message };

  const { data: currentVisit } = await supabase.from("visits").select("invoice_count").eq("id", visitId).single();
  await supabase
    .from("visits")
    .update({ invoice_count: (currentVisit?.invoice_count ?? 0) + 1 })
    .eq("id", visitId);

  revalidatePath(`/divers/${diverId}`);
  revalidatePath("/reports");
  return { invoiceId: invoice.id };
}

// Explicit, separate, user-clicked action — checkout never sends an email
// itself. Sends via Resend (a test/isolated Resend account for now, not the
// live app's connected one — see RESEND_API_KEY in .env.local), and only
// marks the invoice as sent once the email actually goes out successfully.
export async function sendInvoice(diverId: string, invoiceEmailId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: invoice }, { data: diver }, { data: dc }] = await Promise.all([
    supabase
      .from("invoice_emails")
      .select("invoice_snapshot")
      .eq("id", invoiceEmailId)
      .eq("dive_center_id", user.diveCenterId)
      .single(),
    supabase.from("divers").select("email, first_name, last_name").eq("id", diverId).single(),
    supabase.from("dive_centers").select("name").eq("id", user.diveCenterId).single(),
  ]);

  if (!invoice) return { error: "Invoice not found." };
  if (!diver?.email) return { error: "This diver has no email address on file." };

  const html = buildInvoiceEmailHtml({
    diveCenterName: dc?.name ?? "AquaDesk",
    snapshot: (invoice.invoice_snapshot ?? {}) as Record<string, unknown>,
  });

  const resend = getResendClient();
  const { error: sendError } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: diver.email,
    subject: `Your invoice from ${dc?.name ?? "AquaDesk"}`,
    html,
  });

  if (sendError) {
    await supabase
      .from("invoice_emails")
      .update({ email_delivery_status: "failed" })
      .eq("id", invoiceEmailId)
      .eq("dive_center_id", user.diveCenterId);
    revalidatePath(`/divers/${diverId}`);
    return { error: `Could not send invoice email: ${sendError.message}` };
  }

  const { error } = await supabase
    .from("invoice_emails")
    .update({
      email_sent_at: new Date().toISOString(),
      email_sent_by: user.id,
      email_delivery_status: "sent",
    })
    .eq("id", invoiceEmailId)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath(`/divers/${diverId}`);
  return {};
}

// Used right after checkout — visitId isn't known to be closed until the
// insert commits, so re-fetch by the invoice's own visit rather than
// threading extra return values through checkoutVisit.
export async function getInvoiceForVisit(invoiceId: string) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("invoice_emails").select("visit_id").eq("id", invoiceId).maybeSingle();
  if (!data) return null;
  return loadInvoiceForVisit(data.visit_id);
}

// ── Bill unlock ──────────────────────────────────────────────────────────
//
// Verifies against the already-shipped verify_billing_unlock RPC (same
// pattern as settings/staff-access/actions.ts and settings/pricing/
// actions.ts) — never a plaintext password comparison, which is the real
// security bug the blueprint flagged in the live app. On success, writes an
// audit_logs row with action 'bill_unlocked', exactly what Billing Audit's
// Bill Unlock Log already reads.
export async function unlockBill(
  diverId: string,
  visitId: string,
  passwordAttempt: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: verified, error: verifyError } = await supabase.rpc("verify_billing_unlock", {
    p_dive_center_id: user.diveCenterId,
    p_attempt: passwordAttempt,
  });
  if (verifyError) return { error: verifyError.message };
  if (!verified) return { error: "Incorrect billing password." };

  const { data: diver } = await supabase.from("divers").select("first_name, last_name").eq("id", diverId).maybeSingle();
  const diverName = diver ? `${diver.first_name} ${diver.last_name}` : "Diver";

  const { error: visitError } = await supabase
    .from("visits")
    .update({ is_paid: false, is_active: true, visit_status: "open" })
    .eq("id", visitId)
    .eq("dive_center_id", user.diveCenterId);
  if (visitError) return { error: visitError.message };

  const { error: logError } = await supabase.rpc("log_bill_unlock", {
    p_dive_center_id: user.diveCenterId,
    p_visit_id: visitId,
    p_notes: `${diverName} — bill reopened for edits by ${user.fullName}`,
  });
  if (logError) return { error: logError.message };

  revalidatePath(`/divers/${diverId}`);
  revalidatePath("/reports");
  return {};
}
