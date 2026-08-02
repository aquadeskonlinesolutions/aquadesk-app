"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  autoPriceCourseMode,
  autoPricePackageMode,
  autoPriceTierMode,
  getChargeCadence,
  resolveSite,
  otherChargesForSite,
  normalizeSiteKey,
  findPackagesBySiteKey,
} from "./pricing";
import { computePaymentBreakdown, type PaymentInput } from "./billing";
import { loadPaymentConfig, loadInvoiceForVisit } from "./data";
import { buildInvoiceEmailHtml } from "./invoiceEmailHtml";
import { getResendClient, RESEND_FROM_EMAIL } from "@/lib/email/resend";

export type ProfileFormFields = {
  firstName: string;
  lastName: string;
  certificationLevel: string;
  loggedDives: number;
  lastDiveDate: string;
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
      last_dive_date: fields.lastDiveDate || null,
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
  revalidatePath(`/diver-form/${diverId}`);
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
  revalidatePath(`/diver-form/${diverId}`);
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
  revalidatePath(`/diver-form/${diverId}`);
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
  revalidatePath(`/diver-form/${diverId}`);
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
  revalidatePath(`/diver-form/${diverId}`);
  return {};
}

// ── Visits + Activities ─────────────────────────────────────────────────

export async function createVisit(
  diverId: string,
  experienceType: "fun_diving" | "dive_course",
  courseRateId: string | null,
): Promise<{ error?: string; visitId?: string; updatedAt?: string }> {
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
    .select("id, updated_at")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/diver-form/${diverId}`);
  return { visitId: data.id, updatedAt: data.updated_at };
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
  revalidatePath(`/diver-form/${diverId}`);
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
  revalidatePath(`/diver-form/${diverId}`);
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
  revalidatePath(`/diver-form/${diverId}`);
  return {};
}

// Nitrox/15L are never a client-facing checkbox in this codebase (matching
// diver-form.html — there is no such checkbox in the live app either): a
// diver's per-dive tank choice is set upstream, once, by Scheduling's Boat
// Return step (schedule_diver_dive_tanks → activities.flags), and both
// this per-row path and the bulk applyChargesToVisit below read that same
// stored flag rather than any UI toggle.
function tankFlagsFromRow(flags: unknown): { wantsNitrox: boolean; wants15L: boolean } {
  const f = (flags ?? {}) as { nitrox_requested?: boolean; tank_15l_requested?: boolean };
  return { wantsNitrox: f.nitrox_requested === true, wants15L: f.tank_15l_requested === true };
}

// A site-combination that matches 0 or 2+ active packages needs a human
// pick — surfaced to the client instead of guessed at, matching
// diver-form.html's real resolvePackageGroupRates/openRateSelectModal
// (see pricing.ts's own comment: this was the one deliberately-deferred
// piece of that mechanism until now).
export type AmbiguousPackageGroup = {
  siteKey: string;
  sites: string;
  dates: string[];
  matches: { id: string; packageName: string; price: number }[];
};

// Package mode only: resolve a dive rate per site-key group before
// touching any row — a saved visit_rate_selections choice wins silently,
// then a single matching package wins silently, anything else (0 or 2+
// matches) is returned as ambiguous instead of being guessed at.
async function resolvePackageRatesByKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  visitId: string,
  rows: { date: string; dive_site: string | null }[],
): Promise<{
  rateByKey: Map<string, number>;
  // Which specific package resolved each key's rate — a pure display tag
  // (see activities.package_id, migration 032), never read for pricing.
  // null for a key resolved via a custom (non-package) price.
  packageIdByKey: Map<string, string | null>;
  ambiguousGroups: AmbiguousPackageGroup[];
}> {
  const { data: selectionsRaw } = await supabase
    .from("visit_rate_selections")
    .select("site_key, package_id, custom_price")
    .eq("visit_id", visitId);
  const selections = selectionsRaw ?? [];

  const groups = new Map<string, { date: string; dive_site: string | null }[]>();
  for (const row of rows) {
    const key = normalizeSiteKey(row.dive_site ?? "");
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const rateByKey = new Map<string, number>();
  const packageIdByKey = new Map<string, string | null>();
  const ambiguousGroups: AmbiguousPackageGroup[] = [];

  for (const [key, groupRows] of groups) {
    const existing = selections.find((s) => s.site_key === key);
    if (existing) {
      if (existing.package_id) {
        const { data: pkg } = await supabase
          .from("packages")
          .select("price")
          .eq("id", existing.package_id)
          .eq("dive_center_id", diveCenterId)
          .maybeSingle();
        if (pkg) {
          rateByKey.set(key, Number(pkg.price) || 0);
          packageIdByKey.set(key, existing.package_id);
          continue;
        }
        // saved selection points at a package that no longer exists — re-ask below.
      } else if (existing.custom_price !== null) {
        rateByKey.set(key, Number(existing.custom_price));
        packageIdByKey.set(key, null);
        continue;
      }
    }

    const matches = await findPackagesBySiteKey(diveCenterId, key);
    if (matches.length === 1) {
      rateByKey.set(key, matches[0].price);
      packageIdByKey.set(key, matches[0].id);
      continue;
    }
    ambiguousGroups.push({
      siteKey: key,
      sites: groupRows[0].dive_site ?? "",
      dates: [...new Set(groupRows.map((r) => r.date))],
      matches,
    });
  }

  return { rateByKey, packageIdByKey, ambiguousGroups };
}

// The visit-level "Apply Charges" action — modeled directly on
// diver-form.html's real recalculateAllRows(), the *only* pricing-recompute
// mechanism in the live app (there is no per-row auto-price there at all,
// matching this file — per-row auto-price was a rebuild-only addition,
// since removed). Walks every non-cancelled activity in date order,
// recomputing a retroactive tier dive rate from a real running cumulative
// dive count and applying per-day charge-cadence dedup across the whole
// visit in one pass. Package mode resolves rates per site-key first — if
// any combination is ambiguous, returns it instead of writing anything for
// those rows (unambiguous rows in the same visit still get updated).
export async function applyChargesToVisit(
  diverId: string,
  visitId: string,
): Promise<{
  error?: string;
  updatedCount?: number;
  missingRateCount?: number;
  ambiguousGroups?: AmbiguousPackageGroup[];
}> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: visit }, { data: dc }, { data: rowsRaw }] = await Promise.all([
    supabase
      .from("visits")
      .select("experience_type, course_rate_id")
      .eq("id", visitId)
      .eq("dive_center_id", user.diveCenterId)
      .single(),
    supabase.from("dive_centers").select("pricing_mode").eq("id", user.diveCenterId).single(),
    supabase
      .from("activities")
      .select("id, date, dive_site, flags")
      .eq("visit_id", visitId)
      .eq("dive_center_id", user.diveCenterId)
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (!visit) return { error: "Visit not found." };
  const rows = rowsRaw ?? [];
  if (rows.length === 0) return { updatedCount: 0 };

  const isCourse = visit.experience_type === "dive_course";
  const isPackage = !isCourse && dc?.pricing_mode === "package";
  const cadence = isCourse ? null : await getChargeCadence(user.diveCenterId);
  const seenPerDayCharge = {
    marineTax: new Set<string>(),
    sharkFee: new Set<string>(),
    fuel: new Set<string>(),
  };

  let packageRateByKey: Map<string, number> | null = null;
  let packageIdByKey: Map<string, string | null> | null = null;
  if (isPackage) {
    const resolved = await resolvePackageRatesByKey(supabase, user.diveCenterId, visitId, rows);
    if (resolved.ambiguousGroups.length > 0) {
      return { ambiguousGroups: resolved.ambiguousGroups };
    }
    packageRateByKey = resolved.rateByKey;
    packageIdByKey = resolved.packageIdByKey;
  }

  let updatedCount = 0;
  let missingRateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cumulativeDiveCount = i + 1;
    const { wantsNitrox, wants15L } = tankFlagsFromRow(row.flags);
    const diveSiteText = row.dive_site ?? "";

    let resolvedPackageId: string | null | undefined;
    let result;
    if (isCourse) {
      result = await autoPriceCourseMode(user.diveCenterId, visit.course_rate_id);
    } else if (isPackage) {
      const key = normalizeSiteKey(diveSiteText);
      const rate = packageRateByKey?.get(key);
      resolvedPackageId = packageIdByKey?.get(key);
      const site = await resolveSite(user.diveCenterId, diveSiteText);
      const { fuel, marine, shark } = await otherChargesForSite(user.diveCenterId, site);
      result = {
        diveRate: rate ?? 0,
        fuelSurcharge: fuel,
        marineTax: marine,
        sharkFee: shark,
        nitroxFee: 0,
        fifteenLFee: 0,
        note: rate === undefined ? "No dive site set on this row — enter the dive rate manually." : null,
      };
    } else if (dc?.pricing_mode === "tier") {
      result = await autoPriceTierMode(user.diveCenterId, diveSiteText, cumulativeDiveCount, wantsNitrox, wants15L);
    } else {
      return { error: "This dive center has no pricing mode configured yet (see Settings > Pricing & Rates)." };
    }

    if (cadence) {
      if (cadence.marineTax === "per_day") {
        if (seenPerDayCharge.marineTax.has(row.date)) result.marineTax = 0;
        else if (result.marineTax > 0) seenPerDayCharge.marineTax.add(row.date);
      }
      if (cadence.sharkFee === "per_day") {
        if (seenPerDayCharge.sharkFee.has(row.date)) result.sharkFee = 0;
        else if (result.sharkFee > 0) seenPerDayCharge.sharkFee.add(row.date);
      }
      if (cadence.fuelMedium === "per_day" || cadence.fuelHigh === "per_day") {
        if (seenPerDayCharge.fuel.has(row.date)) result.fuelSurcharge = 0;
        else if (result.fuelSurcharge > 0) seenPerDayCharge.fuel.add(row.date);
      }
    }

    if (!isCourse && result.diveRate === 0) missingRateCount++;

    const { error } = await supabase
      .from("activities")
      .update({
        dive_rate: result.diveRate,
        fuel_surcharge: result.fuelSurcharge,
        marine_tax: result.marineTax,
        shark_fee: result.sharkFee,
        nitrox_fee: result.nitroxFee,
        fifteen_l_fee: result.fifteenLFee,
        // Display-only tag (migration 032) — set whenever this row's package
        // resolved unambiguously, cleared (not left stale) if it resolved to
        // a custom price instead. Never read back for pricing itself.
        ...(isPackage ? { package_id: resolvedPackageId ?? null } : {}),
      })
      .eq("id", row.id)
      .eq("dive_center_id", user.diveCenterId);
    if (error) return { error: error.message };
    updatedCount++;
  }

  revalidatePath(`/diver-form/${diverId}`);
  return { updatedCount, missingRateCount };
}

// Persists the secretary's picks for each ambiguous site-combo (a package,
// or a custom price) to visit_rate_selections, then re-runs Apply Charges —
// which will now resolve those same combos silently, matching
// diver-form.html's real resolvePackageGroupRates/saveRateSelection.
export async function saveRateSelectionsAndApply(
  diverId: string,
  visitId: string,
  selections: { siteKey: string; packageId: string | null; customPrice: number | null }[],
): Promise<{
  error?: string;
  updatedCount?: number;
  missingRateCount?: number;
  ambiguousGroups?: AmbiguousPackageGroup[];
}> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  for (const sel of selections) {
    const { error } = await supabase.from("visit_rate_selections").upsert(
      {
        dive_center_id: user.diveCenterId,
        visit_id: visitId,
        site_key: sel.siteKey,
        package_id: sel.packageId,
        custom_price: sel.customPrice,
      },
      { onConflict: "visit_id,site_key" },
    );
    if (error) return { error: error.message };
  }

  return applyChargesToVisit(diverId, visitId);
}

// Fires when a row's Activity dropdown selection changes — matches
// diver-form.html's real onDiveSiteSelected/onCourseSelected: auto-fill
// whatever's resolvable immediately and save, same as the bulk Apply
// Charges pass but for one row picked by hand. Tier-mode site selection
// only fills fuel/shark (matching the live app's real autoFillFromDiveSite
// exactly — dive_rate there only ever comes from the bulk pass, which
// alone knows the row's true cumulative dive count).
export type ActivitySelectionPatch = {
  diveSite: string;
  diveRate?: number;
  fuelSurcharge?: number;
  marineTax?: number;
  sharkFee?: number;
  nitroxFee?: number;
  fifteenLFee?: number;
};

export async function autoFillFromActivitySelection(
  diverId: string,
  activityId: string,
  selection:
    | { kind: "course"; courseRateId: string; courseName: string }
    | { kind: "site"; siteName: string }
    | { kind: "package"; packageId: string; diveSiteCombo: string },
): Promise<{ error?: string; patch?: ActivitySelectionPatch }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  let update: {
    dive_site: string;
    dive_rate?: number;
    fuel_surcharge?: number;
    shark_fee?: number;
    marine_tax?: number;
    nitrox_fee?: number;
    fifteen_l_fee?: number;
    package_id?: string | null;
  };

  if (selection.kind === "course") {
    const result = await autoPriceCourseMode(user.diveCenterId, selection.courseRateId);
    update = {
      dive_site: selection.courseName,
      dive_rate: result.diveRate,
      fuel_surcharge: 0,
      marine_tax: 0,
      shark_fee: 0,
      nitrox_fee: 0,
      fifteen_l_fee: 0,
    };
  } else if (selection.kind === "package") {
    const result = await autoPricePackageMode(user.diveCenterId, selection.diveSiteCombo);
    update = {
      // dive_site stays the raw site combo (matching, Reports' per-site
      // counting) — the user picked one specific package by clicking it,
      // so package_id is known with certainty, no ambiguity to guess at.
      // See markBoatReturned's identical package_id/dive_site split.
      dive_site: selection.diveSiteCombo,
      package_id: selection.packageId,
      dive_rate: result.diveRate,
      fuel_surcharge: result.fuelSurcharge,
      marine_tax: result.marineTax,
      shark_fee: result.sharkFee,
    };
  } else {
    const site = await resolveSite(user.diveCenterId, selection.siteName);
    const { fuel, shark } = await otherChargesForSite(user.diveCenterId, site);
    update = { dive_site: selection.siteName, fuel_surcharge: fuel, shark_fee: shark };
  }

  const { error } = await supabase
    .from("activities")
    .update(update)
    .eq("id", activityId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return { error: error.message };

  revalidatePath(`/diver-form/${diverId}`);
  return {
    patch: {
      diveSite: update.dive_site,
      diveRate: update.dive_rate,
      fuelSurcharge: update.fuel_surcharge,
      marineTax: update.marine_tax,
      sharkFee: update.shark_fee,
      nitroxFee: update.nitrox_fee,
      fifteenLFee: update.fifteen_l_fee,
    },
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
  revalidatePath(`/diver-form/${diverId}`);
  return {};
}

// ── Bill summary / payment (kept open — not checkout) ───────────────────

export async function savePaymentOnly(
  diverId: string,
  visitId: string,
  expectedUpdatedAt: string,
  grandTotalPhp: number,
  depositsTotal: number,
  input: PaymentInput,
): Promise<{ error?: string; conflict?: boolean; updatedAt?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  // This action only ever writes to `payments`, not `visits` — so unlike
  // checkoutVisit (which already has a real visits.update to piggyback the
  // check on), the optimistic-concurrency gate needs its own self-
  // reassignment touch: no visits column actually changes, this exists
  // purely to atomically enforce the version check and bump
  // visits.updated_at (visits_set_updated_at trigger, migration 033) as the
  // shared token both this action and checkoutVisit contend on.
  const { data: visitRow } = await supabase
    .from("visits")
    .select("is_active")
    .eq("id", visitId)
    .eq("dive_center_id", user.diveCenterId)
    .single();
  if (!visitRow) return { error: "Visit not found." };

  const { data: touched, error: touchError } = await supabase
    .from("visits")
    .update({ is_active: visitRow.is_active })
    .eq("id", visitId)
    .eq("dive_center_id", user.diveCenterId)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at")
    .maybeSingle();
  if (touchError) return { error: touchError.message };
  if (!touched) {
    return {
      error: "Someone else already changed this bill — reload the page to see their version before saving.",
      conflict: true,
    };
  }

  const config = await loadPaymentConfig(user.diveCenterId);
  const amountOwed = grandTotalPhp - input.discount - depositsTotal;
  const breakdown = computePaymentBreakdown(input, config.cardSurchargeRate, config.onlineSurchargeRate, amountOwed);
  const balance = Math.max(0, amountOwed - breakdown.totalCollected);

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
      excess_amount: breakdown.excessAmount,
      is_paid: false,
    },
    { onConflict: "visit_id" },
  );

  if (error) return { error: error.message };
  revalidatePath(`/diver-form/${diverId}`);
  return { updatedAt: touched.updated_at };
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
  revalidatePath(`/diver-form/${diverId}`);
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
  expectedUpdatedAt: string,
  input: PaymentInput,
): Promise<{ error?: string; invoiceId?: string; conflict?: boolean }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: diver }, { data: activitiesRaw }, { data: depositsRaw }] = await Promise.all([
    supabase.from("divers").select("first_name, last_name, nationality").eq("id", diverId).single(),
    supabase
      .from("activities")
      .select(
        "date, dive_site, package_id, staff_name, dive_rate, fuel_surcharge, marine_tax, shark_fee, nitrox_fee, fifteen_l_fee, equipment_rental, addons, status",
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
  const amountOwed = grandTotal - input.discount - depositsTotal;
  const breakdown = computePaymentBreakdown(input, config.cardSurchargeRate, config.onlineSurchargeRate, amountOwed);
  const balance = amountOwed - breakdown.totalCollected;

  if (balance > 0.01) {
    return { error: `Balance of ₱${Math.round(balance).toLocaleString()} still due — collect full payment before checkout.` };
  }

  // Optimistic-concurrency check: this WHERE clause only matches if nobody
  // else has changed the visit since expectedUpdatedAt was loaded (the
  // visits_set_updated_at trigger, migration 033, bumps updated_at on every
  // write) — protects against two sessions both clicking Checkout on the
  // same bill near-simultaneously, which would otherwise silently overwrite
  // one payment breakdown with the other's and create two invoice snapshots.
  const { data: visitClosed, error: visitError } = await supabase
    .from("visits")
    .update({
      is_paid: true,
      is_active: false,
      visit_end: new Date().toISOString().slice(0, 10),
      visit_status: "closed",
    })
    .eq("id", visitId)
    .eq("dive_center_id", user.diveCenterId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (visitError) return { error: visitError.message };
  if (!visitClosed) {
    return {
      error: "Someone else already changed this bill — reload the page to see their version before checking out.",
      conflict: true,
    };
  }

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
      excess_amount: breakdown.excessAmount,
      is_paid: true,
      paid_at: new Date().toISOString(),
    },
    { onConflict: "visit_id" },
  );
  if (paymentError) return { error: paymentError.message };

  // Resolve any resolved package_ids to their friendly package_name for the
  // invoice's own dive_site display — the invoice reads this as plain text
  // (InvoicePanel.tsx), unlike Reports Overview's per-site activity bars or
  // Apply Charges' site-combo matching, both of which need the row's real
  // dive_site (the raw joined site combo) left untouched. Falls back to the
  // raw combo for any row with no resolved package_id (tier mode, or a
  // package-mode row never run through Apply Charges/Boat Return's match).
  const packageIds = [...new Set(completed.map((a) => a.package_id).filter((id): id is string => !!id))];
  const { data: packageRows } = packageIds.length
    ? await supabase.from("packages").select("id, package_name").in("id", packageIds)
    : { data: [] };
  const packageNameById = new Map((packageRows ?? []).map((p) => [p.id, p.package_name]));

  const diverName = `${diver.first_name} ${diver.last_name}`;
  const snapshot = {
    diver_name: diverName,
    nationality: diver.nationality,
    activities: completed.map((a) => ({
      date: a.date,
      dive_site: (a.package_id && packageNameById.get(a.package_id)) || a.dive_site,
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
      excess_amount: breakdown.excessAmount,
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

  revalidatePath(`/diver-form/${diverId}`);
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
    diveCenterName: dc?.name ?? "Your Dive Center",
    snapshot: (invoice.invoice_snapshot ?? {}) as Record<string, unknown>,
  });

  const resend = getResendClient();
  const { error: sendError } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: diver.email,
    subject: `Your invoice from ${dc?.name ?? "Your Dive Center"}`,
    html,
  });

  if (sendError) {
    await supabase
      .from("invoice_emails")
      .update({ email_delivery_status: "failed" })
      .eq("id", invoiceEmailId)
      .eq("dive_center_id", user.diveCenterId);
    revalidatePath(`/diver-form/${diverId}`);
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
  revalidatePath(`/diver-form/${diverId}`);
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

  revalidatePath(`/diver-form/${diverId}`);
  revalidatePath("/reports");
  return {};
}
