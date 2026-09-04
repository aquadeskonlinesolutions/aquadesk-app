import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DiverDetail = {
  id: string;
  firstName: string;
  lastName: string;
  traceNumber: string | null;
  birthday: string | null;
  age: number | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  certificationLevel: string;
  trainingAgency: string | null;
  loggedDives: number;
  lastDiveDate: string | null;
  nitroxCertified: boolean;
  groupId: string | null;
  groupName: string | null;
  needsEquipment: boolean;
  equipmentRequested: string | null;
  medicalAcknowledgedAt: string | null;
  medicalAcknowledgedBy: string | null;
  certCardUrl: string | null;
  notes: string | null;
  accommodation: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactWhatsapp: string | null;
  emergencyContactEmail: string | null;
  foodAllergies: string | null;
  hasDiveInsurance: boolean | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  isMinor: boolean;
  latestArrivalDate: string | null;
  latestDepartureDate: string | null;
  medicalFlag: boolean;
  medicalAnswersSnapshot: { question_text: string; answer: unknown }[];
};

export async function loadDiverDetail(diverId: string, diveCenterId: string): Promise<DiverDetail | null> {
  const supabase = await createClient();

  const { data: diver } = await supabase
    .from("divers")
    .select(
      "id, first_name, last_name, trace_number, birthday, age, nationality, email, phone, whatsapp, certification_level, training_agency, logged_dives, last_dive_date, nitrox_certified, group_id, needs_equipment, equipment_requested, medical_acknowledged_at, medical_acknowledged_by, cert_card_url, notes, accommodation, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_whatsapp, emergency_contact_email, food_allergies, has_dive_insurance, insurance_provider, insurance_policy_number, is_minor",
    )
    .eq("id", diverId)
    .eq("dive_center_id", diveCenterId)
    .maybeSingle();

  if (!diver) return null;

  const [{ data: group }, { data: latestRegistration }] = await Promise.all([
    diver.group_id
      ? supabase.from("groups").select("group_name").eq("id", diver.group_id).maybeSingle()
      : Promise.resolve({ data: null as { group_name: string } | null }),
    supabase
      .from("diver_registrations")
      .select("arrival_date, departure_date, medical_flag, medical_answers_snapshot")
      .eq("diver_id", diverId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    id: diver.id,
    firstName: diver.first_name,
    lastName: diver.last_name,
    traceNumber: diver.trace_number,
    birthday: diver.birthday,
    age: diver.age,
    nationality: diver.nationality,
    email: diver.email,
    phone: diver.phone,
    whatsapp: diver.whatsapp,
    certificationLevel: diver.certification_level,
    trainingAgency: diver.training_agency,
    loggedDives: diver.logged_dives ?? 0,
    lastDiveDate: diver.last_dive_date,
    nitroxCertified: !!diver.nitrox_certified,
    groupId: diver.group_id,
    groupName: group?.group_name ?? null,
    needsEquipment: !!diver.needs_equipment,
    equipmentRequested: diver.equipment_requested,
    medicalAcknowledgedAt: diver.medical_acknowledged_at,
    medicalAcknowledgedBy: diver.medical_acknowledged_by,
    certCardUrl: diver.cert_card_url,
    notes: diver.notes,
    accommodation: diver.accommodation,
    emergencyContactName: diver.emergency_contact_name,
    emergencyContactPhone: diver.emergency_contact_phone,
    emergencyContactRelationship: diver.emergency_contact_relationship,
    emergencyContactWhatsapp: diver.emergency_contact_whatsapp,
    emergencyContactEmail: diver.emergency_contact_email,
    foodAllergies: diver.food_allergies,
    hasDiveInsurance: diver.has_dive_insurance,
    insuranceProvider: diver.insurance_provider,
    insurancePolicyNumber: diver.insurance_policy_number,
    isMinor: !!diver.is_minor,
    latestArrivalDate: latestRegistration?.arrival_date ?? null,
    latestDepartureDate: latestRegistration?.departure_date ?? null,
    medicalFlag: !!latestRegistration?.medical_flag,
    medicalAnswersSnapshot: (latestRegistration?.medical_answers_snapshot as
      | { question_text: string; answer: unknown }[]
      | null) ?? [],
  };
}

export type DiverNote = {
  id: string;
  note: string;
  authorName: string;
  createdAt: string;
};

export async function loadDiverNotes(diverId: string): Promise<DiverNote[]> {
  const supabase = await createClient();

  const { data: notes } = await supabase
    .from("diver_notes")
    .select("id, note, created_by, created_at")
    .eq("diver_id", diverId)
    .order("created_at", { ascending: false });

  const rows = notes ?? [];
  const userIds = [...new Set(rows.map((n) => n.created_by).filter((id): id is string => !!id))];

  const { data: users } = userIds.length
    ? await supabase.from("users").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  return rows.map((n) => ({
    id: n.id,
    note: n.note,
    authorName: (n.created_by && userMap.get(n.created_by)) || "—",
    createdAt: n.created_at,
  }));
}

export type EquipmentRentalItem = {
  id: string;
  itemName: string;
  rate: number;
  chargeType: "per_dive" | "per_day";
};

export async function loadEquipmentRentalRates(diveCenterId: string): Promise<EquipmentRentalItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("equipment_rental_rates")
    .select("id, item_name, rate, charge_type")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("item_name");

  return (data ?? []).map((r) => ({
    id: r.id,
    itemName: r.item_name,
    rate: Number(r.rate) || 0,
    chargeType: r.charge_type as "per_dive" | "per_day",
  }));
}

export type Deposit = {
  id: string;
  amount: number;
  method: "cash" | "card" | "online";
  depositDate: string;
  receivedBy: string | null;
};

export async function loadDeposits(visitId: string): Promise<Deposit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deposits")
    .select("id, amount, method, deposit_date, received_by")
    .eq("visit_id", visitId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((d) => ({
    id: d.id,
    amount: Number(d.amount) || 0,
    method: d.method,
    depositDate: d.deposit_date,
    receivedBy: d.received_by,
  }));
}

export type ExistingPayment = {
  cashAmount: number;
  cashAmountForeign: number;
  cashCurrencyCode: string | null;
  cashExchangeRate: number;
  cardAmount: number;
  onlineAmount: number;
  discount: number;
};

// `payments.is_paid` isn't fetched — BillSummary (the only reader of this
// type) only ever renders while the visit is still open, and checkout
// (the only thing that sets is_paid = true) closes the visit in the same
// transaction, so a fetched value would always read false here anyway.
export async function loadExistingPayment(visitId: string): Promise<ExistingPayment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("cash_amount, cash_amount_foreign, cash_currency_code, cash_exchange_rate, card_amount, online_amount, discount")
    .eq("visit_id", visitId)
    .maybeSingle();

  if (!data) return null;
  return {
    cashAmount: Number(data.cash_amount) || 0,
    cashAmountForeign: Number(data.cash_amount_foreign) || 0,
    cashCurrencyCode: data.cash_currency_code,
    cashExchangeRate: Number(data.cash_exchange_rate) || 0,
    cardAmount: Number(data.card_amount) || 0,
    onlineAmount: Number(data.online_amount) || 0,
    discount: Number(data.discount) || 0,
  };
}

export type PaymentConfig = {
  cardSurchargeRate: number;
  onlineSurchargeRate: number;
  currencies: { code: string; rateToPhp: number }[];
};

export async function loadPaymentConfig(diveCenterId: string): Promise<PaymentConfig> {
  const supabase = await createClient();
  const [{ data: surcharges }, { data: currencies }] = await Promise.all([
    supabase.from("payment_surcharges").select("surcharge_type, rate").eq("dive_center_id", diveCenterId),
    supabase
      .from("exchange_rates")
      .select("currency_code, rate_to_php")
      .eq("dive_center_id", diveCenterId)
      .eq("is_active", true)
      .order("currency_code"),
  ]);

  const card = (surcharges ?? []).find((s) => s.surcharge_type === "card");
  const online = (surcharges ?? []).find((s) => s.surcharge_type === "online");

  return {
    cardSurchargeRate: Number(card?.rate) || 0,
    onlineSurchargeRate: Number(online?.rate) || 0,
    currencies: (currencies ?? []).map((c) => ({ code: c.currency_code, rateToPhp: Number(c.rate_to_php) || 0 })),
  };
}

export type VisitInvoice = {
  id: string;
  sentAt: string;
  closedBy: string | null;
  snapshot: Record<string, unknown>;
  emailSentAt: string | null;
  emailDeliveryStatus: "not_sent" | "sent" | "failed";
};

// Most recent invoice_emails row for a visit — a closed visit always has at
// least one (written by checkoutVisit); a still-open visit has none yet.
export async function loadInvoiceForVisit(visitId: string): Promise<VisitInvoice | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoice_emails")
    .select("id, sent_at, invoice_snapshot, email_sent_at, email_delivery_status")
    .eq("visit_id", visitId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const snapshot = (data.invoice_snapshot ?? {}) as Record<string, unknown>;
  return {
    id: data.id,
    sentAt: data.sent_at,
    closedBy: typeof snapshot.closed_by === "string" ? snapshot.closed_by : null,
    snapshot,
    emailSentAt: data.email_sent_at,
    emailDeliveryStatus: (data.email_delivery_status as "not_sent" | "sent" | "failed") ?? "not_sent",
  };
}

export type RegistrationRecord = {
  id: string;
  createdAt: string;
  arrivalDate: string | null;
  departureDate: string | null;
  accommodation: string | null;
  certificationLevel: string | null;
  waiverContentSnapshot: string | null;
  waiverDate: string | null;
  waiverSignatureUrl: string | null;
  waiverSigned: boolean;
  medicalAnswersSnapshot: { question_text: string; answer: unknown }[];
  medicalFlag: boolean;
  privacyNoticeSnapshot: string | null;
  privacyConsentAt: string | null;
  // Identity snapshot, frozen at signing time (migration 017) — null on
  // registrations from before that migration, in which case the caller
  // should fall back to the diver's current profile fields.
  firstName: string | null;
  lastName: string | null;
  birthday: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
};

export async function loadDiverRegistrations(diverId: string): Promise<RegistrationRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("diver_registrations")
    .select(
      "id, created_at, arrival_date, departure_date, accommodation, certification_level, waiver_content_snapshot, waiver_date, waiver_signature_url, waiver_signed, medical_answers_snapshot, medical_flag, privacy_notice_snapshot, privacy_consent_at, first_name, last_name, birthday, nationality, email, phone, whatsapp",
    )
    .eq("diver_id", diverId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    arrivalDate: r.arrival_date,
    departureDate: r.departure_date,
    accommodation: r.accommodation,
    certificationLevel: r.certification_level,
    waiverContentSnapshot: r.waiver_content_snapshot,
    waiverDate: r.waiver_date,
    waiverSignatureUrl: r.waiver_signature_url,
    waiverSigned: !!r.waiver_signed,
    medicalAnswersSnapshot:
      (r.medical_answers_snapshot as { question_text: string; answer: unknown }[] | null) ?? [],
    medicalFlag: !!r.medical_flag,
    privacyNoticeSnapshot: r.privacy_notice_snapshot,
    privacyConsentAt: r.privacy_consent_at,
    firstName: r.first_name,
    lastName: r.last_name,
    birthday: r.birthday,
    nationality: r.nationality,
    email: r.email,
    phone: r.phone,
    whatsapp: r.whatsapp,
  }));
}

export type CourseRateOption = { id: string; courseName: string; rate: number };

export async function loadCourseRates(diveCenterId: string): Promise<CourseRateOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_rates")
    .select("id, course_name, rate")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("course_name");

  return (data ?? []).map((c) => ({ id: c.id, courseName: c.course_name, rate: Number(c.rate) || 0 }));
}

// Multi-dive bundles (Settings > Courses > Bundles, migration 037) — flat
// price for a fixed dive count, applied per visit via "Apply Bundle".
export type BundleOption = {
  id: string;
  name: string;
  diveCount: number;
  price: number;
  equipmentIncluded: boolean;
};

export async function loadBundles(diveCenterId: string): Promise<BundleOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bundles")
    .select("id, name, dive_count, price, equipment_included")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("dive_count");

  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    diveCount: b.dive_count,
    price: Number(b.price) || 0,
    equipmentIncluded: !!b.equipment_included,
  }));
}

// ── Visits + Activities ─────────────────────────────────────────────────

export type Visit = {
  id: string;
  // Version token for optimistic-concurrency checks (checkoutVisit/
  // savePaymentOnly) — migration 033's visits.updated_at + set_updated_at()
  // trigger. An owner and a secretary both working the same bill without
  // knowing it get an explicit conflict instead of one silently
  // overwriting the other's payment breakdown or double-processing checkout.
  updatedAt: string;
  experienceType: "fun_diving" | "dive_course";
  visitStart: string;
  visitEnd: string | null;
  visitStatus: "open" | "closed" | "voided";
  isActive: boolean;
  invoiceCount: number;
  courseRateId: string | null;
  courseName: string | null;
};

export type Activity = {
  id: string;
  visitId: string;
  scheduleId: string | null;
  date: string;
  diveSite: string | null;
  // Which package this row resolved to (set by Boat Return or the manual
  // package-select dropdown, migration 032) — a pure display/identity tag,
  // never read for pricing; diveSite always stays the raw site combo that
  // pricing/Reports actually match and count on.
  packageId: string | null;
  // Which bundle collapsed this row's charges (Settings > Courses >
  // Bundles, migration 037) — set only on the one row carrying the bundle's
  // lump-sum price, purely a display tag (VisitPanel italicizes diveSite
  // when set), never read for pricing.
  bundleId: string | null;
  staffName: string | null;
  diveRate: number;
  fuelSurcharge: number;
  marineTax: number;
  sharkFee: number;
  nitroxFee: number;
  fifteenLFee: number;
  equipmentRental: number;
  addons: number;
  discount: number;
  total: number;
  status: "planned" | "scheduled" | "ongoing" | "completed" | "cancelled";
  notes: string | null;
};

// The most recent visit for this diver — open if one exists, otherwise the
// most recently closed/voided one for read-only reference. Full multi-visit
// history browsing isn't in scope here (Reports/Billing Audit already cover
// historical reporting); this page is about the diver's *current* activity.
export async function loadLatestVisit(diverId: string, diveCenterId: string): Promise<Visit | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("visits")
    .select(
      "id, updated_at, experience_type, visit_start, visit_end, visit_status, is_active, invoice_count, course_rate_id",
    )
    .eq("diver_id", diverId)
    .eq("dive_center_id", diveCenterId)
    .order("visit_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const { data: course } = data.course_rate_id
    ? await supabase.from("course_rates").select("course_name").eq("id", data.course_rate_id).maybeSingle()
    : { data: null as { course_name: string } | null };

  return {
    id: data.id,
    updatedAt: data.updated_at,
    experienceType: data.experience_type,
    visitStart: data.visit_start,
    visitEnd: data.visit_end,
    visitStatus: data.visit_status,
    isActive: data.is_active,
    invoiceCount: data.invoice_count ?? 0,
    courseRateId: data.course_rate_id,
    courseName: course?.course_name ?? null,
  };
}

export async function loadActivities(visitId: string): Promise<Activity[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("activities")
    .select(
      "id, visit_id, schedule_id, date, dive_site, package_id, bundle_id, staff_name, dive_rate, fuel_surcharge, marine_tax, shark_fee, nitrox_fee, fifteen_l_fee, equipment_rental, addons, discount, total, status, notes",
    )
    .eq("visit_id", visitId)
    .order("date", { ascending: true });

  return (data ?? []).map((a) => ({
    id: a.id,
    visitId: a.visit_id,
    scheduleId: a.schedule_id,
    date: a.date,
    diveSite: a.dive_site,
    packageId: a.package_id,
    bundleId: a.bundle_id,
    staffName: a.staff_name,
    diveRate: Number(a.dive_rate) || 0,
    fuelSurcharge: Number(a.fuel_surcharge) || 0,
    marineTax: Number(a.marine_tax) || 0,
    sharkFee: Number(a.shark_fee) || 0,
    nitroxFee: Number(a.nitrox_fee) || 0,
    fifteenLFee: Number(a.fifteen_l_fee) || 0,
    equipmentRental: Number(a.equipment_rental) || 0,
    addons: Number(a.addons) || 0,
    discount: Number(a.discount) || 0,
    total: Number(a.total) || 0,
    status: a.status,
    notes: a.notes,
  }));
}

// Feeds the Activity column's dropdown (tier mode: real dive sites,
// matching diver-form.html's real buildActivityCell fun-diving branch).
export type DiveSiteOption = { id: string; siteName: string };
export async function loadDiveSites(diveCenterId: string): Promise<DiveSiteOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dive_sites")
    .select("id, site_name")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("site_name");
  return (data ?? []).map((s) => ({ id: s.id, siteName: s.site_name }));
}

// Feeds the Activity column's dropdown in package mode — a rebuild-only
// choice (the live app never lets you pick a package directly on a row,
// only a raw site) per the user's explicit ask: package mode's Activity
// cell shows the package name, not the site.
export type PackageOption = { id: string; packageName: string; diveSite: string; price: number };
export async function loadActivePackages(diveCenterId: string): Promise<PackageOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("packages")
    .select("id, package_name, dive_site, price")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("package_name");
  return (data ?? []).map((p) => ({
    id: p.id,
    packageName: p.package_name,
    diveSite: p.dive_site ?? "",
    price: Number(p.price) || 0,
  }));
}

// visit_rate_selections — already in the base schema (001), unused until
// now. Remembers which package (or custom price) was picked for a given
// site-key combination on this visit, so Apply Charges only asks once
// per ambiguous combo and stays silent on every re-run afterward.
export type RateSelection = { id: string; siteKey: string; packageId: string | null; customPrice: number | null };
export async function loadRateSelections(visitId: string): Promise<RateSelection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visit_rate_selections")
    .select("id, site_key, package_id, custom_price")
    .eq("visit_id", visitId);
  return (data ?? []).map((r) => ({
    id: r.id,
    siteKey: r.site_key,
    packageId: r.package_id,
    customPrice: r.custom_price !== null ? Number(r.custom_price) : null,
  }));
}
