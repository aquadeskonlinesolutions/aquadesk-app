"use server";

import { revalidatePath } from "next/cache";
import { requireRevenueAccess } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { safeNum, type PaymentChannel } from "@/lib/payments";
import {
  loadOverviewData,
  loadMonthlyFinancials,
  loadMonthlyFunVsCourseRevenue,
  loadTopNationalitiesYTD,
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
import { BASE_EXPENSE_CATEGORIES } from "./constants";
import { resolveOnlineChannel } from "@/lib/paymentChannels";

// Shared by every settle/payout action that records an online channel
// (join ride settlement, rental gear settlement, staff commission
// payout) — `channel` here is always either a base PaymentChannel key or
// the literal "custom" (already translated client-side from whatever UI
// state produced it), never the raw ADD_CHANNEL_VALUE sentinel.
async function resolveChannelForOnline(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diveCenterId: string,
  paymentMethod: string | null | undefined,
  channel: string | null | undefined,
  customChannelId: string | null | undefined,
  newChannelLabel: string | null | undefined,
): Promise<{ error: string } | { channel: PaymentChannel | null; customChannelId: string | null }> {
  if (paymentMethod !== "online" || !channel) {
    return { channel: null, customChannelId: null };
  }
  if (channel === "custom") {
    return resolveOnlineChannel(supabase, diveCenterId, {
      channelId: customChannelId ?? null,
      newChannelLabel: newChannelLabel ?? null,
    });
  }
  return { channel: channel as PaymentChannel, customChannelId: null };
}

export async function getOverviewData(dateFrom: string, dateTo: string) {
  const user = await requireRevenueAccess();
  return loadOverviewData(user.diveCenterId, dateFrom, dateTo);
}

export async function getMonthlyFinancials() {
  const user = await requireRevenueAccess();
  return loadMonthlyFinancials(user.diveCenterId);
}

export async function getMonthlyFunVsCourseRevenue() {
  const user = await requireRevenueAccess();
  return loadMonthlyFunVsCourseRevenue(user.diveCenterId);
}

export async function getTopNationalitiesYTD() {
  const user = await requireRevenueAccess();
  return loadTopNationalitiesYTD(user.diveCenterId);
}

export async function getStaffActivityData(dateFrom: string, dateTo: string) {
  const user = await requireRevenueAccess();
  return loadStaffActivityData(user.diveCenterId, dateFrom, dateTo);
}

// diverId is only ever passed (non-null) for dive_educator rows — Leading
// Our Dives stays grouped per trip, not per diver, matching how it's
// sourced (see loadStaffActivityData's leaderGroups).
async function findExistingCommission(
  diveCenterId: string,
  group: "dive_leader" | "dive_educator",
  staffName: string,
  title: string,
  activityDate: string,
  diverId: string | null,
) {
  const supabase = await createClient();
  let query = supabase
    .from("staff_commission_records")
    .select("id, status, paid_at, remarks, payment_method, channel, custom_channel_id")
    .eq("dive_center_id", diveCenterId)
    .eq("commission_group", group)
    .eq("staff_name", staffName)
    .eq("title", title)
    .eq("activity_date", activityDate);
  query = group === "dive_educator" ? query.eq("diver_id", diverId) : query;
  const { data } = await query.maybeSingle();
  return data;
}

// Commission and Additional Rate are both manually-entered lump sums —
// Total = their sum, never multiplied from dives/divers. dives/divers are
// still persisted (a snapshot of the trip this row is for), just no longer
// part of the stored total's formula.
export async function saveDiveLeaderCommission(
  activityDate: string,
  staffName: string,
  site: string,
  dives: number,
  divers: number,
  commissionAmount: number,
  additionalRate: number,
  markPaid: boolean,
  paymentMethod?: "cash" | "card" | "online" | null,
  channel?: string | null,
  customChannelId?: string | null,
  newChannelLabel?: string | null,
): Promise<{
  error?: string;
  status?: "unpaid" | "paid";
  commissionAmount?: number;
  additionalRate?: number;
  total?: number;
  paymentMethod?: "cash" | "card" | "online" | null;
  channel?: PaymentChannel | null;
  customChannelId?: string | null;
}> {
  if (markPaid) {
    if (!paymentMethod) return { error: "Select a payment method." };
    if (paymentMethod === "online" && !channel) return { error: "Select an Online channel." };
  }

  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const resolved = markPaid
    ? await resolveChannelForOnline(supabase, user.diveCenterId, paymentMethod, channel, customChannelId, newChannelLabel)
    : { channel: null, customChannelId: null };
  if ("error" in resolved) return { error: resolved.error };

  const existing = await findExistingCommission(user.diveCenterId, "dive_leader", staffName, site, activityDate, null);
  const status: "unpaid" | "paid" = markPaid ? "paid" : ((existing?.status as "unpaid" | "paid") ?? "unpaid");
  const payload = {
    dive_center_id: user.diveCenterId,
    activity_date: activityDate,
    staff_name: staffName,
    commission_group: "dive_leader" as const,
    title: site,
    quantity: dives,
    divers,
    rate: 0,
    bonus_amount: additionalRate,
    commission_amount: commissionAmount,
    status,
    paid_at: markPaid ? new Date().toISOString() : (existing?.paid_at ?? null),
    payment_method: markPaid ? paymentMethod : (existing?.payment_method ?? null),
    channel: markPaid ? resolved.channel : (existing?.channel ?? null),
    custom_channel_id: markPaid ? resolved.customChannelId : (existing?.custom_channel_id ?? null),
    remarks: existing?.remarks ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing?.id
    ? await supabase.from("staff_commission_records").update(payload).eq("id", existing.id)
    : await supabase.from("staff_commission_records").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/reports");
  return {
    status,
    commissionAmount,
    additionalRate,
    total: commissionAmount + additionalRate,
    paymentMethod: payload.payment_method,
    channel: payload.channel,
    customChannelId: payload.custom_channel_id,
  };
}

// Same shape as saveDiveLeaderCommission but per-student (diverId) — course
// pay structures (fixed/percentage/gross/net) are too inconsistent to
// formulaically calculate from a rate, so both Commission and Additional
// Rate are always typed directly by the secretary.
export async function saveInstructorCommission(
  activityDate: string,
  staffName: string,
  diverId: string,
  course: string,
  commissionAmount: number,
  additionalRate: number,
  markPaid: boolean,
  paymentMethod?: "cash" | "card" | "online" | null,
  channel?: string | null,
  customChannelId?: string | null,
  newChannelLabel?: string | null,
): Promise<{
  error?: string;
  status?: "unpaid" | "paid";
  commissionAmount?: number;
  additionalRate?: number;
  total?: number;
  paymentMethod?: "cash" | "card" | "online" | null;
  channel?: PaymentChannel | null;
  customChannelId?: string | null;
}> {
  if (markPaid) {
    if (!paymentMethod) return { error: "Select a payment method." };
    if (paymentMethod === "online" && !channel) return { error: "Select an Online channel." };
  }

  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const resolved = markPaid
    ? await resolveChannelForOnline(supabase, user.diveCenterId, paymentMethod, channel, customChannelId, newChannelLabel)
    : { channel: null, customChannelId: null };
  if ("error" in resolved) return { error: resolved.error };

  const existing = await findExistingCommission(
    user.diveCenterId,
    "dive_educator",
    staffName,
    course,
    activityDate,
    diverId,
  );
  const status: "unpaid" | "paid" = markPaid ? "paid" : ((existing?.status as "unpaid" | "paid") ?? "unpaid");
  const payload = {
    dive_center_id: user.diveCenterId,
    activity_date: activityDate,
    staff_name: staffName,
    commission_group: "dive_educator" as const,
    title: course,
    diver_id: diverId,
    quantity: 1,
    divers: 0,
    rate: 0,
    bonus_amount: additionalRate,
    commission_amount: commissionAmount,
    status,
    paid_at: markPaid ? new Date().toISOString() : (existing?.paid_at ?? null),
    payment_method: markPaid ? paymentMethod : (existing?.payment_method ?? null),
    channel: markPaid ? resolved.channel : (existing?.channel ?? null),
    custom_channel_id: markPaid ? resolved.customChannelId : (existing?.custom_channel_id ?? null),
    remarks: existing?.remarks ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing?.id
    ? await supabase.from("staff_commission_records").update(payload).eq("id", existing.id)
    : await supabase.from("staff_commission_records").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/reports");
  return {
    status,
    commissionAmount,
    additionalRate,
    total: commissionAmount + additionalRate,
    paymentMethod: payload.payment_method,
    channel: payload.channel,
    customChannelId: payload.custom_channel_id,
  };
}

// ── Join Ride ────────────────────────────────────────────────────────────

export async function getJoinRideData() {
  const user = await requireRevenueAccess();
  return loadJoinRideData(user.diveCenterId);
}

function isSettledStatus(status: string): boolean {
  return status === "collected" || status === "paid";
}

// The one fixed starting status per direction — a brand-new record can
// never be created already-settled, matching "do not allow selecting
// status during creation." Kept as a server-side floor (not just a UI
// omission) so a crafted request can't create a pre-settled record either.
const STARTING_STATUS: Record<JoinRideDirection, string> = {
  joined_our_boat: "to_collect",
  we_joined_another_boat: "expected_to_pay",
};

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
  const resolvedStatus = id ? status : STARTING_STATUS[direction];

  const payload = {
    dive_center_id: user.diveCenterId,
    direction,
    date,
    company: trimmedCompany,
    number_of_divers: numberOfDivers,
    number_of_dives: numberOfDives,
    dive_sites: diveSites.trim() || null,
    total_amount: total,
    status: resolvedStatus,
    balance: isSettledStatus(resolvedStatus) ? 0 : total,
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

export async function updateJoinRideStatus(
  id: string,
  status: string,
  paymentMethod?: "cash" | "card" | "online" | null,
  channel?: string | null,
  customChannelId?: string | null,
  newChannelLabel?: string | null,
): Promise<{ error?: string }> {
  if (isSettledStatus(status)) {
    if (!paymentMethod) return { error: "Select a payment method." };
    if (paymentMethod === "online" && !channel) return { error: "Select an Online channel." };
  }

  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const resolved = isSettledStatus(status)
    ? await resolveChannelForOnline(supabase, user.diveCenterId, paymentMethod, channel, customChannelId, newChannelLabel)
    : { channel: null, customChannelId: null };
  if ("error" in resolved) return { error: resolved.error };

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
      payment_method: isSettledStatus(status) ? paymentMethod : null,
      channel: resolved.channel,
      custom_channel_id: resolved.customChannelId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

// Once Collected/Paid, a record can still be Edited but never Deleted —
// enforced here too, not just by hiding the button, since the status
// itself lives in the database and could be settled between page loads.
export async function deleteJoinRideRecord(id: string): Promise<{ error?: string }> {
  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("join_ride_records")
    .select("status")
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId)
    .single();
  if (existing && isSettledStatus(existing.status)) {
    return { error: "This record is already settled and can no longer be deleted." };
  }

  const { error } = await supabase
    .from("join_ride_records")
    .delete()
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

  // Rental Gear has no separate direction column — the flat status is the
  // only signal for "we're owed" (to_collect) vs. "we owe" (to_pay), so a
  // new record still needs one of those two, just never a settled value
  // (collected/paid) straight out of creation. Defense in depth to match
  // "status should not be selectable during creation."
  const resolvedStatus = id ? status : status === "to_pay" ? "to_pay" : "to_collect";
  const total = quantity * rate;
  const payload = {
    dive_center_id: user.diveCenterId,
    date,
    equipment: trimmedEquipment,
    company: trimmedCompany,
    quantity,
    rate,
    total_amount: total,
    status: resolvedStatus,
    balance: isSettledStatus(resolvedStatus) ? 0 : total,
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

export async function updateRentalGearStatus(
  id: string,
  status: string,
  paymentMethod?: "cash" | "card" | "online" | null,
  channel?: string | null,
  customChannelId?: string | null,
  newChannelLabel?: string | null,
): Promise<{ error?: string }> {
  if (isSettledStatus(status)) {
    if (!paymentMethod) return { error: "Select a payment method." };
    if (paymentMethod === "online" && !channel) return { error: "Select an Online channel." };
  }

  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const resolved = isSettledStatus(status)
    ? await resolveChannelForOnline(supabase, user.diveCenterId, paymentMethod, channel, customChannelId, newChannelLabel)
    : { channel: null, customChannelId: null };
  if ("error" in resolved) return { error: resolved.error };

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
      payment_method: isSettledStatus(status) ? paymentMethod : null,
      channel: resolved.channel,
      custom_channel_id: resolved.customChannelId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId);

  if (error) return { error: error.message };
  revalidatePath("/reports");
  return {};
}

// Once Collected/Paid, a record can still be Edited but never Deleted —
// same server-side floor as deleteJoinRideRecord.
export async function deleteRentalGearRecord(id: string): Promise<{ error?: string }> {
  const user = await requireRevenueAccess();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("rental_gear_records")
    .select("status")
    .eq("id", id)
    .eq("dive_center_id", user.diveCenterId)
    .single();
  if (existing && isSettledStatus(existing.status)) {
    return { error: "This record is already settled and can no longer be deleted." };
  }

  const { error } = await supabase
    .from("rental_gear_records")
    .delete()
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
  channel: string | null,
  notes: string,
  // Only meaningful when category === "custom": customCategoryId reuses an
  // existing per-dive-center category picked straight from the dropdown;
  // newCategoryLabel is what was typed via "+ Add Category" and still
  // needs the dedup-match-or-create resolution below. Exactly one of the
  // two is ever set.
  customCategoryId: string | null = null,
  newCategoryLabel: string | null = null,
  // Same idea for the online channel: meaningful only when channel ===
  // "custom".
  channelId: string | null = null,
  newChannelLabel: string | null = null,
): Promise<{ error?: string }> {
  if (!date) return { error: "Date is required." };
  if (!(amount > 0)) return { error: "Amount must be greater than 0." };

  const user = await requireRevenueAccess();
  const supabase = await createClient();

  let resolvedCustomCategoryId: string | null = null;

  if (category === "custom") {
    if (customCategoryId) {
      resolvedCustomCategoryId = customCategoryId;
    } else {
      const typed = (newCategoryLabel ?? "").trim();
      if (!typed) return { error: "Enter a category name." };
      const normalized = typed.toLowerCase();

      // Case-insensitive/trimmed match against the 12 real base categories
      // first — reuse the base category instead of creating a near-duplicate
      // custom one (e.g. typing "fuel" reuses the existing Fuel category).
      const baseMatch = BASE_EXPENSE_CATEGORIES.find(([, label]) => label.trim().toLowerCase() === normalized);
      if (baseMatch) {
        category = baseMatch[0];
      } else {
        const { data: existingCategory } = await supabase
          .from("expense_categories")
          .select("id")
          .eq("dive_center_id", user.diveCenterId)
          .eq("normalized_label", normalized)
          .maybeSingle();
        if (existingCategory) {
          resolvedCustomCategoryId = existingCategory.id;
        } else {
          const { data: created, error: createError } = await supabase
            .from("expense_categories")
            .insert({ dive_center_id: user.diveCenterId, label: typed, normalized_label: normalized })
            .select("id")
            .single();
          if (createError) {
            // Two secretaries typing the same new category at the same
            // moment can both miss the check above — the unique constraint
            // on (dive_center_id, normalized_label) catches it; fall back
            // to whichever row actually won instead of surfacing the raw
            // conflict error.
            if (createError.code === "23505") {
              const { data: raceWinner } = await supabase
                .from("expense_categories")
                .select("id")
                .eq("dive_center_id", user.diveCenterId)
                .eq("normalized_label", normalized)
                .maybeSingle();
              if (!raceWinner) return { error: createError.message };
              resolvedCustomCategoryId = raceWinner.id;
            } else {
              return { error: createError.message };
            }
          } else {
            resolvedCustomCategoryId = created.id;
          }
        }
      }
    }
  }

  if (paymentMethod === "online" && !channel) {
    // Grandfathers a pre-existing online expense recorded before the
    // channel field existed — resaving it unchanged doesn't need a
    // channel; changing the amount or re-picking Online as the method
    // does. Matches the same grandfathering on the bill-payment side.
    const existing = id
      ? await supabase
          .from("expenses")
          .select("amount, payment_method")
          .eq("id", id)
          .eq("dive_center_id", user.diveCenterId)
          .maybeSingle()
      : { data: null };
    const unchanged =
      existing.data && existing.data.payment_method === "online" && Number(existing.data.amount) === amount;
    if (!unchanged) {
      return { error: "Select an Online channel." };
    }
  }

  let finalChannel: PaymentChannel | null = null;
  let finalCustomChannelId: string | null = null;
  if (paymentMethod === "online" && channel) {
    const resolved = await resolveChannelForOnline(supabase, user.diveCenterId, paymentMethod, channel, channelId, newChannelLabel);
    if ("error" in resolved) return { error: resolved.error };
    finalChannel = resolved.channel;
    finalCustomChannelId = resolved.customChannelId;
  }

  const payload = {
    dive_center_id: user.diveCenterId,
    date,
    category,
    custom_category: category === "other" ? customCategory.trim() || null : null,
    custom_category_id: category === "custom" ? resolvedCustomCategoryId : null,
    amount,
    payment_method: paymentMethod || null,
    channel: finalChannel,
    custom_channel_id: finalCustomChannelId,
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
