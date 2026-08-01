"use server";

import { revalidatePath } from "next/cache";
import { requireRevenueAccess } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { safeNum } from "@/lib/payments";
import {
  loadOverviewData,
  loadStaffActivityData,
  loadJoinRideData,
  loadRentalGearsData,
  loadExpensesData,
  loadSettlementData,
  loadGovtFeesData,
  loadBillingAuditData,
  type JoinRideDirection,
  type GovtFeeType,
} from "./data";

export async function getOverviewData(dateFrom: string, dateTo: string) {
  const user = await requireRevenueAccess();
  return loadOverviewData(user.diveCenterId, dateFrom, dateTo);
}

export async function getStaffActivityData(dateFrom: string, dateTo: string) {
  const user = await requireRevenueAccess();
  return loadStaffActivityData(user.diveCenterId, dateFrom, dateTo);
}

async function findExistingCommission(
  diveCenterId: string,
  group: "dive_leader" | "dive_educator",
  staffName: string,
  title: string,
  activityDate: string,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_commission_records")
    .select("id, status, paid_at, remarks")
    .eq("dive_center_id", diveCenterId)
    .eq("commission_group", group)
    .eq("staff_name", staffName)
    .eq("title", title)
    .eq("activity_date", activityDate)
    .maybeSingle();
  return data;
}

// Divemaster pay is automatic (dives × rate) plus an optional manual ratio
// bonus — never a formula, just whatever the secretary types in for that
// specific day's over-4-diver group.
export async function saveDiveLeaderCommission(
  activityDate: string,
  staffName: string,
  site: string,
  dives: number,
  divers: number,
  rate: number,
  bonusAmount: number,
  markPaid: boolean,
): Promise<{ error?: string; status?: "unpaid" | "paid"; rate?: number; bonusAmount?: number; amount?: number }> {
  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const existing = await findExistingCommission(user.diveCenterId, "dive_leader", staffName, site, activityDate);
  const status: "unpaid" | "paid" = markPaid ? "paid" : ((existing?.status as "unpaid" | "paid") ?? "unpaid");
  const amount = dives * rate + bonusAmount;
  const payload = {
    dive_center_id: user.diveCenterId,
    activity_date: activityDate,
    staff_name: staffName,
    commission_group: "dive_leader" as const,
    title: site,
    quantity: dives,
    divers,
    rate,
    bonus_amount: bonusAmount,
    commission_amount: amount,
    status,
    paid_at: markPaid ? new Date().toISOString() : (existing?.paid_at ?? null),
    remarks: existing?.remarks ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing?.id
    ? await supabase.from("staff_commission_records").update(payload).eq("id", existing.id)
    : await supabase.from("staff_commission_records").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/reports");
  return { status, rate, bonusAmount, amount };
}

// Instructor pay is never auto-multiplied — course pay structures (fixed,
// percentage, gross/net) are too inconsistent to formulaically calculate,
// so the secretary always types the final payout amount directly.
export async function saveInstructorCommission(
  activityDate: string,
  staffName: string,
  course: string,
  students: number,
  amount: number,
  markPaid: boolean,
): Promise<{ error?: string; status?: "unpaid" | "paid"; amount?: number }> {
  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const existing = await findExistingCommission(user.diveCenterId, "dive_educator", staffName, course, activityDate);
  const status: "unpaid" | "paid" = markPaid ? "paid" : ((existing?.status as "unpaid" | "paid") ?? "unpaid");
  const payload = {
    dive_center_id: user.diveCenterId,
    activity_date: activityDate,
    staff_name: staffName,
    commission_group: "dive_educator" as const,
    title: course,
    quantity: students,
    divers: 0,
    rate: 0,
    bonus_amount: 0,
    commission_amount: amount,
    status,
    paid_at: markPaid ? new Date().toISOString() : (existing?.paid_at ?? null),
    remarks: existing?.remarks ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing?.id
    ? await supabase.from("staff_commission_records").update(payload).eq("id", existing.id)
    : await supabase.from("staff_commission_records").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/reports");
  return { status, amount };
}

// ── Join Ride ────────────────────────────────────────────────────────────

export async function getJoinRideData() {
  const user = await requireRevenueAccess();
  return loadJoinRideData(user.diveCenterId);
}

function isSettledStatus(status: string): boolean {
  return status === "collected" || status === "paid";
}

export async function saveJoinRideRecord(
  id: string | null,
  direction: JoinRideDirection,
  date: string,
  company: string,
  numberOfDivers: number,
  numberOfDives: number,
  diveSites: string,
  remarks: string,
  status: string,
): Promise<{ error?: string }> {
  const trimmedCompany = company.trim();
  if (!date || !trimmedCompany) return { error: "Date and company are required." };

  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const { data: dc } = await supabase
    .from("dive_centers")
    .select("join_ride_rate_per_diver_per_dive")
    .eq("id", user.diveCenterId)
    .single();
  const rate = safeNum(dc?.join_ride_rate_per_diver_per_dive);
  const total = numberOfDivers * numberOfDives * rate;

  const payload = {
    dive_center_id: user.diveCenterId,
    direction,
    date,
    company: trimmedCompany,
    number_of_divers: numberOfDivers,
    number_of_dives: numberOfDives,
    dive_sites: diveSites.trim() || null,
    total_amount: total,
    status,
    balance: isSettledStatus(status) ? 0 : total,
    remarks: remarks.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("join_ride_records").update(payload).eq("id", id).eq("dive_center_id", user.diveCenterId)
    : await supabase.from("join_ride_records").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

export async function updateJoinRideStatus(id: string, status: string): Promise<{ error?: string }> {
  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("join_ride_records")
    .select("total_amount")
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId)
    .single();

  const { error } = await supabase
    .from("join_ride_records")
    .update({
      status,
      balance: isSettledStatus(status) ? 0 : safeNum(existing?.total_amount),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

export type StatementLineItem = {
  date: string;
  diveSites: string | null;
  numberOfDivers: number;
  numberOfDives: number;
  totalAmount: number;
};

export async function generateJoinRideStatement(
  company: string,
  dateFrom: string,
  dateTo: string,
  status: "to_collect" | "statement_printed",
  preparedBy: string,
): Promise<{
  error?: string;
  statementId?: string;
  lineItems?: StatementLineItem[];
  total?: number;
}> {
  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const { data: matching } = await supabase
    .from("join_ride_records")
    .select("id, date, dive_sites, number_of_divers, number_of_dives, total_amount")
    .eq("dive_center_id", user.diveCenterId)
    .eq("direction", "joined_our_boat")
    .eq("company", company)
    .eq("status", status)
    .gte("date", dateFrom)
    .lte("date", dateTo);

  if (!matching || matching.length === 0) {
    return { error: "No matching records for this company, date range, and status." };
  }

  const total = matching.reduce((s, r) => s + safeNum(r.total_amount), 0);

  const { data: statement, error: stmtError } = await supabase
    .from("join_ride_statements")
    .insert({
      dive_center_id: user.diveCenterId,
      company,
      date_from: dateFrom,
      date_to: dateTo,
      total_amount: total,
      status: "statement_printed",
      prepared_by: preparedBy,
      printed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (stmtError) return { error: stmtError.message };

  const ids = matching.map((r) => r.id);
  const { error: updError } = await supabase
    .from("join_ride_records")
    .update({
      status: "statement_printed",
      statement_id: statement.id,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (updError) return { error: updError.message };

  revalidatePath("/reports");
  return {
    statementId: statement.id,
    total,
    lineItems: matching
      .map((r) => ({
        date: r.date,
        diveSites: r.dive_sites,
        numberOfDivers: r.number_of_divers ?? 0,
        numberOfDives: r.number_of_dives ?? 0,
        totalAmount: safeNum(r.total_amount),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ── Rental Gears ─────────────────────────────────────────────────────────

export async function getRentalGearsData() {
  const user = await requireRevenueAccess();
  return loadRentalGearsData(user.diveCenterId);
}

export async function saveRentalGearRecord(
  id: string | null,
  date: string,
  equipment: string,
  company: string,
  quantity: number,
  rate: number,
  status: string,
  remarks: string,
): Promise<{ error?: string }> {
  const trimmedEquipment = equipment.trim();
  const trimmedCompany = company.trim();
  if (!date || !trimmedEquipment || !trimmedCompany) {
    return { error: "Date, equipment, and company are required." };
  }

  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const total = quantity * rate;
  const payload = {
    dive_center_id: user.diveCenterId,
    date,
    equipment: trimmedEquipment,
    company: trimmedCompany,
    quantity,
    rate,
    total_amount: total,
    status,
    balance: isSettledStatus(status) ? 0 : total,
    remarks: remarks.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("rental_gear_records").update(payload).eq("id", id).eq("dive_center_id", user.diveCenterId)
    : await supabase.from("rental_gear_records").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

export async function updateRentalGearStatus(id: string, status: string): Promise<{ error?: string }> {
  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("rental_gear_records")
    .select("total_amount")
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId)
    .single();

  const { error } = await supabase
    .from("rental_gear_records")
    .update({
      status,
      balance: isSettledStatus(status) ? 0 : safeNum(existing?.total_amount),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

// ── Expenses ─────────────────────────────────────────────────────────────

export async function getExpensesData(dateFrom: string, dateTo: string) {
  const user = await requireRevenueAccess();
  return loadExpensesData(user.diveCenterId, dateFrom, dateTo);
}

export async function saveExpenseRecord(
  id: string | null,
  date: string,
  category: string,
  customCategory: string,
  amount: number,
  paymentMethod: string,
  notes: string,
): Promise<{ error?: string }> {
  if (!date) return { error: "Date is required." };
  if (!(amount > 0)) return { error: "Amount must be greater than 0." };

  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const payload = {
    dive_center_id: user.diveCenterId,
    date,
    category,
    custom_category: category === "other" ? customCategory.trim() || null : null,
    amount,
    payment_method: paymentMethod || null,
    notes: notes.trim() || null,
  };

  // created_by ("Recorded By") is set only on insert — who first logged the
  // expense, not whoever most recently edited it, matching the same
  // immutable-audit-trail semantic diver notes already use.
  const { error } = id
    ? await supabase.from("expenses").update(payload).eq("id", id).eq("dive_center_id", user.diveCenterId)
    : await supabase.from("expenses").insert({ ...payload, created_by: user.id });

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

export async function deleteExpenseRecord(id: string): Promise<{ error?: string }> {
  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

// ── Settlement ───────────────────────────────────────────────────────────

export async function getSettlementData(date: string) {
  const user = await requireRevenueAccess();
  return loadSettlementData(user.diveCenterId, date);
}

// ── Government Fees ─────────────────────────────────────────────────────

export async function getGovtFeesData(dateFrom: string, dateTo: string) {
  const user = await requireRevenueAccess();
  return loadGovtFeesData(user.diveCenterId, dateFrom, dateTo);
}

export type GovtFeeDraftRow = {
  date: string;
  feeType: GovtFeeType;
  rate: number;
  divers: number;
};

// Bulk-inserts only newly added (unsaved) rows in one call, matching the
// live app's "add several rows, then Save All" flow — total is always
// server-computed from rate × divers, never trusted from the client.
export async function saveGovtFeeRows(rows: GovtFeeDraftRow[]): Promise<{ error?: string }> {
  if (rows.length === 0) return {};

  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const inserts = rows.map((r) => ({
    dive_center_id: user.diveCenterId,
    date: r.date,
    fee_type: r.feeType,
    rate: r.rate,
    divers: r.divers,
    total: r.rate * r.divers,
  }));

  const { error } = await supabase.from("govt_fees").insert(inserts);

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

export async function deleteGovtFeeRecord(id: string): Promise<{ error?: string }> {
  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const { error } = await supabase
    .from("govt_fees")
    .delete()
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

// ── Billing Audit ────────────────────────────────────────────────────────

export async function getBillingAuditData() {
  const user = await requireRevenueAccess();
  return loadBillingAuditData(user.diveCenterId);
}
