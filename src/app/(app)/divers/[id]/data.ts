import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DiverDetail = {
  id: string;
  firstName: string;
  lastName: string;
  birthday: string | null;
  age: number | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  certificationLevel: string;
  trainingAgency: string | null;
  loggedDives: number;
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
      "id, first_name, last_name, birthday, age, nationality, email, phone, whatsapp, certification_level, training_agency, logged_dives, nitrox_certified, group_id, needs_equipment, equipment_requested, medical_acknowledged_at, medical_acknowledged_by, cert_card_url, notes, accommodation, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, emergency_contact_whatsapp, emergency_contact_email, food_allergies, has_dive_insurance, insurance_provider, insurance_policy_number, is_minor",
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
    birthday: diver.birthday,
    age: diver.age,
    nationality: diver.nationality,
    email: diver.email,
    phone: diver.phone,
    whatsapp: diver.whatsapp,
    certificationLevel: diver.certification_level,
    trainingAgency: diver.training_agency,
    loggedDives: diver.logged_dives ?? 0,
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
  isPaid: boolean;
};

export async function loadExistingPayment(visitId: string): Promise<ExistingPayment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("cash_amount, cash_amount_foreign, cash_currency_code, cash_exchange_rate, card_amount, online_amount, discount, is_paid")
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
    isPaid: data.is_paid,
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
};

export async function loadDiverRegistrations(diverId: string): Promise<RegistrationRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("diver_registrations")
    .select(
      "id, created_at, arrival_date, departure_date, accommodation, certification_level, waiver_content_snapshot, waiver_date, waiver_signature_url, waiver_signed, medical_answers_snapshot, medical_flag, privacy_notice_snapshot, privacy_consent_at",
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

export async function loadPricingMode(diveCenterId: string): Promise<"package" | "tier" | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dive_centers")
    .select("pricing_mode")
    .eq("id", diveCenterId)
    .maybeSingle();
  return (data?.pricing_mode as "package" | "tier" | null) ?? null;
}

// ── Visits + Activities ─────────────────────────────────────────────────

export type Visit = {
  id: string;
  experienceType: "fun_diving" | "dive_course";
  visitStart: string;
  visitEnd: string | null;
  visitStatus: "open" | "closed" | "voided";
  isActive: boolean;
  isPaid: boolean;
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
      "id, experience_type, visit_start, visit_end, visit_status, is_active, is_paid, invoice_count, course_rate_id",
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
    experienceType: data.experience_type,
    visitStart: data.visit_start,
    visitEnd: data.visit_end,
    visitStatus: data.visit_status,
    isActive: data.is_active,
    isPaid: data.is_paid,
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
      "id, visit_id, schedule_id, date, dive_site, staff_name, dive_rate, fuel_surcharge, marine_tax, shark_fee, nitrox_fee, fifteen_l_fee, equipment_rental, addons, discount, total, status, notes",
    )
    .eq("visit_id", visitId)
    .order("date", { ascending: true });

  return (data ?? []).map((a) => ({
    id: a.id,
    visitId: a.visit_id,
    scheduleId: a.schedule_id,
    date: a.date,
    diveSite: a.dive_site,
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
