import "server-only";
import { createClient } from "@/lib/supabase/server";
import { safeNum, getPaidAmount, PAYMENT_CHANNEL_LABELS, type PaymentChannel } from "@/lib/payments";
import { EXPENSE_CATEGORY_LABELS } from "./constants";

// Same helper as dashboard/data.ts's own manilaDayBoundsUtcIso (duplicated
// per this codebase's established per-page small-helper precedent) — the
// UTC instant range that covers one Manila calendar date. Every date-range
// filter in this file against a plain `date` column (activities.date,
// expenses.date, govt_fees.date, staff_commission_records.activity_date)
// is already timezone-safe since there's no time component to misalign —
// but `payments.paid_at` is a real timestamptz, and comparing it against
// literal UTC-midnight strings for a Manila-run business silently drops
// early-morning Manila payments into "yesterday" and leaks the next day's
// early-morning payments into "today." Found and fixed here; see
// loadOverviewData's and loadSettlementData's use of this helper below.
function manilaDayBoundsUtcIso(dateStr: string) {
  const startMs = Date.parse(`${dateStr}T00:00:00.000Z`) - 8 * 60 * 60 * 1000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + 86_400_000 - 1).toISOString(),
  };
}

// Same +8h-shift-then-read-UTC-fields trick as manilaDayBoundsUtcIso above,
// just producing a plain Y-M-D string instead of an instant range — used by
// the monthly/YTD Overview charts below (loadMonthlyFinancials et al.),
// which need "what is today/this month in Manila" without ever round-
// tripping through a JS Date's *local* fields (the class of bug already
// documented throughout this project's CLAUDE.md).
function manilaTodayStr(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function manilaMonthFromIso(iso: string): string {
  return new Date(Date.parse(iso) + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function manilaDateFromIso(iso: string): string {
  return new Date(Date.parse(iso) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Trailing N calendar months (Manila-anchored), oldest first, ending with
// the current (partial) month — e.g. ["2025-09", ..., "2026-08"].
function trailingMonths(n: number): string[] {
  const [y, m] = manilaTodayStr().split("-").map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let year = y;
    let month = m - i;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

function expenseGroupLabel(category: string, customCategory: string | null): string {
  if (category === "other") {
    const custom = customCategory?.trim();
    return custom ? `Other – ${custom}` : "Other (unspecified)";
  }
  return EXPENSE_CATEGORY_LABELS[category] ?? "Uncategorized";
}

export type BusinessSummary = {
  moneyIn: number;
  collectedFromDivers: number;
  excessCollected: number;
  rentalIncome: number;
  joinIncome: number;
  moneyOut: number;
  govtFees: number;
  expenses: number;
  rentalExpense: number;
  joinExpense: number;
  commissionsPaid: number;
  netProfit: number;
  notYetSettled: number;
  openDiverBills: number;
  rentalToCollect: number;
  rentalToPay: number;
  joinToCollect: number;
  joinToPay: number;
  unpaidCommissions: number;
};

export type OverviewData = {
  diveCenterName: string;
  divesServed: number;
  // Distinct calendar dates that had at least one completed dive in range —
  // not a row count. activities is one row per diver per site per dive, so
  // a single 6-diver, 2-site day already produces 12 rows; "12 completed
  // dives" read as a vague, inflated figure with no clear meaning (divers ×
  // dives? total activity rows?). Counting distinct dates instead answers
  // the actually-useful question: over how many days did this happen.
  daysServed: number;
  summary: BusinessSummary;
};

export async function loadOverviewData(
  diveCenterId: string,
  dateFrom: string,
  dateTo: string,
): Promise<OverviewData> {
  const supabase = await createClient();

  const [
    { data: dc },
    { data: activitiesInRange },
    { data: paymentsInRange },
    { data: openVisits },
    { data: rentalRecords },
    { data: joinRecords },
    { data: commissionRecords },
    { data: expensesInRange },
    { data: govtFeesInRange },
  ] = await Promise.all([
    supabase.from("dive_centers").select("name").eq("id", diveCenterId).single(),
    supabase
      .from("activities")
      .select("diver_id, status, date")
      .eq("dive_center_id", diveCenterId)
      .gte("date", dateFrom)
      .lte("date", dateTo),
    supabase
      .from("payments")
      .select(
        "total_collected, total_paid, cash_amount, cash_amount_foreign, cash_exchange_rate, card_amount, card_surcharge_amount, online_amount, online_surcharge_amount, excess_amount",
      )
      .eq("dive_center_id", diveCenterId)
      .gte("paid_at", manilaDayBoundsUtcIso(dateFrom).startIso)
      .lte("paid_at", manilaDayBoundsUtcIso(dateTo).endIso),
    supabase
      .from("visits")
      .select("id")
      .eq("dive_center_id", diveCenterId)
      .eq("is_active", true)
      .eq("is_paid", false),
    supabase.from("rental_gear_records").select("date, status, total_amount, balance").eq("dive_center_id", diveCenterId),
    supabase
      .from("join_ride_records")
      .select("date, direction, status, total_amount, balance")
      .eq("dive_center_id", diveCenterId),
    supabase
      .from("staff_commission_records")
      .select("status, commission_amount, bonus_amount")
      .eq("dive_center_id", diveCenterId)
      .gte("activity_date", dateFrom)
      .lte("activity_date", dateTo),
    supabase
      .from("expenses")
      .select("amount, category, custom_category")
      .eq("dive_center_id", diveCenterId)
      .gte("date", dateFrom)
      .lte("date", dateTo),
    supabase
      .from("govt_fees")
      .select("total")
      .eq("dive_center_id", diveCenterId)
      .gte("date", dateFrom)
      .lte("date", dateTo),
  ]);

  // ── Served/completed counts ────────────────────────────────────────────
  const completedActivities = (activitiesInRange ?? []).filter(
    (a) => a.status === "completed",
  );
  const divesServed = new Set(completedActivities.map((a) => a.diver_id)).size;
  const daysServed = new Set(completedActivities.map((a) => a.date)).size;

  // ── Collected from divers (money actually received in range) ──────────
  // Reads the stored total_collected/total_paid (getPaidAmount already
  // prefers these) rather than recomputing from the raw per-method fields —
  // cash_amount_foreign × cash_exchange_rate is the *tendered* foreign-cash
  // conversion, which can legitimately exceed what's owed (e.g. a ₱11,500
  // bill paid with $210 at ₱57 = ₱11,970); the stored total is deliberately
  // capped to what was actually owed, per the "reconcile to what was
  // billed, not what was physically handed over" decision. Recomputing here
  // would silently re-inflate past that cap.
  const collectedFromDivers = (paymentsInRange ?? []).reduce((sum, p) => sum + getPaidAmount(p), 0);

  // Tendered above what was billed (foreign cash overshoot, etc.) — real
  // money handled, but deliberately excluded from collectedFromDivers/
  // moneyIn/netProfit above. Informational only; see payments.excess_amount.
  const excessCollected = (paymentsInRange ?? []).reduce((sum, p) => sum + safeNum(p.excess_amount), 0);

  // ── Open diver bills (current outstanding balance, not date-bound) ────
  const openVisitIds = (openVisits ?? []).map((v) => v.id);
  let openDiverBills = 0;
  if (openVisitIds.length > 0) {
    const [{ data: openActivities }, { data: openPayments }] = await Promise.all([
      supabase.from("activities").select("visit_id, total").in("visit_id", openVisitIds),
      supabase
        .from("payments")
        .select(
          "visit_id, total_collected, total_paid, cash_amount, card_amount, online_amount, card_surcharge_amount, online_surcharge_amount",
        )
        .in("visit_id", openVisitIds),
    ]);
    openDiverBills = openVisitIds.reduce((sum, visitId) => {
      const total = (openActivities ?? [])
        .filter((a) => a.visit_id === visitId)
        .reduce((s, a) => s + safeNum(a.total), 0);
      const payment = (openPayments ?? []).find((p) => p.visit_id === visitId);
      return sum + Math.max(0, total - getPaidAmount(payment));
    }, 0);
  }

  // ── Rental gear ─────────────────────────────────────────────────────────
  const rentals = rentalRecords ?? [];
  const rentalIncome = rentals
    .filter((r) => r.status === "collected" && r.date >= dateFrom && r.date <= dateTo)
    .reduce((s, r) => s + safeNum(r.total_amount), 0);
  const rentalExpense = rentals
    .filter((r) => r.status === "paid" && r.date >= dateFrom && r.date <= dateTo)
    .reduce((s, r) => s + safeNum(r.total_amount), 0);
  const rentalToCollect = rentals
    .filter((r) => r.status === "to_collect")
    .reduce((s, r) => s + (r.balance != null ? safeNum(r.balance) : safeNum(r.total_amount)), 0);
  const rentalToPay = rentals
    .filter((r) => r.status === "to_pay")
    .reduce((s, r) => s + (r.balance != null ? safeNum(r.balance) : safeNum(r.total_amount)), 0);

  // ── Join ride ───────────────────────────────────────────────────────────
  const joinRides = joinRecords ?? [];
  const joinIncome = joinRides
    .filter(
      (r) =>
        r.direction === "joined_our_boat" &&
        r.status === "collected" &&
        r.date >= dateFrom &&
        r.date <= dateTo,
    )
    .reduce((s, r) => s + safeNum(r.total_amount), 0);
  const joinExpense = joinRides
    .filter(
      (r) =>
        r.direction === "we_joined_another_boat" &&
        r.status === "paid" &&
        r.date >= dateFrom &&
        r.date <= dateTo,
    )
    .reduce((s, r) => s + safeNum(r.total_amount), 0);
  const joinToCollect = joinRides
    .filter((r) => r.direction === "joined_our_boat" && r.status !== "collected")
    .reduce((s, r) => s + (r.balance != null ? safeNum(r.balance) : safeNum(r.total_amount)), 0);
  const joinToPay = joinRides
    .filter((r) => r.direction === "we_joined_another_boat" && r.status !== "paid")
    .reduce((s, r) => s + (r.balance != null ? safeNum(r.balance) : safeNum(r.total_amount)), 0);

  // ── Staff commissions (scoped to the selected date range, per-line-item) ──
  // Sums commission_amount + bonus_amount ("Commission" + "Additional Rate"
  // in the Staff Activity Summary tab) — a row's real Total, not just its
  // Commission field alone. These previously only summed commission_amount,
  // silently undercounting any row with a non-zero Additional Rate; fixed
  // so Overview's Outstanding/Paid figures match what the Staff tab itself
  // shows as each row's Total.
  const commissions = commissionRecords ?? [];
  const commissionTotal = (r: { commission_amount: number; bonus_amount: number }) =>
    safeNum(r.commission_amount) + safeNum(r.bonus_amount);
  const commissionsPaid = commissions.filter((r) => r.status === "paid").reduce((s, r) => s + commissionTotal(r), 0);
  const unpaidCommissions = commissions
    .filter((r) => r.status !== "paid")
    .reduce((s, r) => s + commissionTotal(r), 0);

  // ── Expenses ────────────────────────────────────────────────────────────
  const expenses = expensesInRange ?? [];
  const expenseTotal = expenses.reduce((s, r) => s + safeNum(r.amount), 0);

  // ── Government fees ─────────────────────────────────────────────────────
  const govtFeesTotal = (govtFeesInRange ?? []).reduce((s, r) => s + safeNum(r.total), 0);

  const moneyIn = collectedFromDivers + rentalIncome + joinIncome;
  const moneyOut = govtFeesTotal + expenseTotal + rentalExpense + joinExpense + commissionsPaid;
  const netProfit = moneyIn - moneyOut;
  const notYetSettled =
    openDiverBills + rentalToCollect + rentalToPay + joinToCollect + joinToPay + unpaidCommissions;

  return {
    diveCenterName: dc?.name ?? "Dive Center",
    divesServed,
    daysServed,
    summary: {
      moneyIn,
      collectedFromDivers,
      excessCollected,
      rentalIncome,
      joinIncome,
      moneyOut,
      govtFees: govtFeesTotal,
      expenses: expenseTotal,
      rentalExpense,
      joinExpense,
      commissionsPaid,
      netProfit,
      notYetSettled,
      openDiverBills,
      rentalToCollect,
      rentalToPay,
      joinToCollect,
      joinToPay,
      unpaidCommissions,
    },
  };
}

// ── Overview: monthly / YTD charts ──────────────────────────────────────
//
// These three are deliberately independent of loadOverviewData's dateFrom/
// dateTo — they compute their own trailing-12-month or year-to-date window
// so the charts stay stable while a secretary changes the page's date
// filter (which still drives the KPI cards / Business Summary above,
// untouched). "Revenue" here matches loadOverviewData's own moneyIn
// formula (diver payments collected + rental income + join-ride income),
// just bucketed by month instead of by an arbitrary range, so these charts
// stay numerically consistent with the KPI cards rather than introducing a
// second, different notion of "revenue."

export type MonthlyFinancials = { month: string; revenue: number; expenses: number; profit: number };
export type MonthlyFunVsCourseRevenue = { month: string; funRevenue: number; courseRevenue: number };
export type NationalityCount = { nationality: string; count: number };

export async function loadMonthlyFinancials(diveCenterId: string, months = 12): Promise<MonthlyFinancials[]> {
  const supabase = await createClient();
  const monthKeys = trailingMonths(months);
  const rangeFrom = `${monthKeys[0]}-01`;
  const rangeTo = manilaTodayStr();
  const { startIso: rangeStartIso } = manilaDayBoundsUtcIso(rangeFrom);
  const { endIso: rangeEndIso } = manilaDayBoundsUtcIso(rangeTo);

  const [
    { data: paymentsRaw },
    { data: rentalsRaw },
    { data: joinRaw },
    { data: commissionsRaw },
    { data: expensesRaw },
    { data: govtRaw },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "paid_at, total_collected, total_paid, cash_amount, cash_amount_foreign, cash_exchange_rate, card_amount, card_surcharge_amount, online_amount, online_surcharge_amount",
      )
      .eq("dive_center_id", diveCenterId)
      .gte("paid_at", rangeStartIso)
      .lte("paid_at", rangeEndIso),
    supabase
      .from("rental_gear_records")
      .select("date, status, total_amount")
      .eq("dive_center_id", diveCenterId)
      .gte("date", rangeFrom)
      .lte("date", rangeTo),
    supabase
      .from("join_ride_records")
      .select("date, direction, status, total_amount")
      .eq("dive_center_id", diveCenterId)
      .gte("date", rangeFrom)
      .lte("date", rangeTo),
    supabase
      .from("staff_commission_records")
      .select("activity_date, status, commission_amount, bonus_amount")
      .eq("dive_center_id", diveCenterId)
      .gte("activity_date", rangeFrom)
      .lte("activity_date", rangeTo),
    supabase
      .from("expenses")
      .select("date, amount")
      .eq("dive_center_id", diveCenterId)
      .gte("date", rangeFrom)
      .lte("date", rangeTo),
    supabase
      .from("govt_fees")
      .select("date, total")
      .eq("dive_center_id", diveCenterId)
      .gte("date", rangeFrom)
      .lte("date", rangeTo),
  ]);

  const revenueByMonth = new Map<string, number>();
  const expensesByMonth = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, amount: number) => {
    if (!monthKeys.includes(key)) return;
    map.set(key, (map.get(key) ?? 0) + amount);
  };

  (paymentsRaw ?? []).forEach((p) => {
    add(revenueByMonth, manilaMonthFromIso(p.paid_at), getPaidAmount(p));
  });
  (rentalsRaw ?? []).forEach((r) => {
    const key = r.date.slice(0, 7);
    if (r.status === "collected") add(revenueByMonth, key, safeNum(r.total_amount));
    if (r.status === "paid") add(expensesByMonth, key, safeNum(r.total_amount));
  });
  (joinRaw ?? []).forEach((r) => {
    const key = r.date.slice(0, 7);
    if (r.direction === "joined_our_boat" && r.status === "collected") add(revenueByMonth, key, safeNum(r.total_amount));
    if (r.direction === "we_joined_another_boat" && r.status === "paid") add(expensesByMonth, key, safeNum(r.total_amount));
  });
  (commissionsRaw ?? []).forEach((r) => {
    if (r.status !== "paid") return;
    add(expensesByMonth, r.activity_date.slice(0, 7), safeNum(r.commission_amount) + safeNum(r.bonus_amount));
  });
  (expensesRaw ?? []).forEach((r) => {
    add(expensesByMonth, r.date.slice(0, 7), safeNum(r.amount));
  });
  (govtRaw ?? []).forEach((r) => {
    add(expensesByMonth, r.date.slice(0, 7), safeNum(r.total));
  });

  return monthKeys.map((month) => {
    const revenue = revenueByMonth.get(month) ?? 0;
    const expenses = expensesByMonth.get(month) ?? 0;
    return { month, revenue, expenses, profit: revenue - expenses };
  });
}

export async function loadMonthlyFunVsCourseRevenue(
  diveCenterId: string,
  months = 12,
): Promise<MonthlyFunVsCourseRevenue[]> {
  const supabase = await createClient();
  const monthKeys = trailingMonths(months);
  const rangeFrom = `${monthKeys[0]}-01`;
  const rangeTo = manilaTodayStr();

  const { data: activitiesRaw } = await supabase
    .from("activities")
    .select("date, total, visit_id")
    .eq("dive_center_id", diveCenterId)
    .eq("status", "completed")
    .gte("date", rangeFrom)
    .lte("date", rangeTo);

  const rows = activitiesRaw ?? [];
  const visitIds = [...new Set(rows.map((a) => a.visit_id))];
  const { data: visitsData } = visitIds.length
    ? await supabase.from("visits").select("id, experience_type").in("id", visitIds)
    : { data: [] as { id: string; experience_type: string }[] };
  const visitMap = new Map((visitsData ?? []).map((v) => [v.id, v.experience_type]));

  const funByMonth = new Map<string, number>();
  const courseByMonth = new Map<string, number>();
  rows.forEach((a) => {
    const key = a.date.slice(0, 7);
    if (!monthKeys.includes(key)) return;
    const amount = safeNum(a.total);
    if (visitMap.get(a.visit_id) === "dive_course") {
      courseByMonth.set(key, (courseByMonth.get(key) ?? 0) + amount);
    } else {
      funByMonth.set(key, (funByMonth.get(key) ?? 0) + amount);
    }
  });

  return monthKeys.map((month) => ({
    month,
    funRevenue: funByMonth.get(month) ?? 0,
    courseRevenue: courseByMonth.get(month) ?? 0,
  }));
}

export async function loadTopNationalitiesYTD(diveCenterId: string): Promise<NationalityCount[]> {
  const supabase = await createClient();
  const todayStr = manilaTodayStr();
  const yearStart = `${todayStr.slice(0, 4)}-01-01`;

  const { data: activitiesRaw } = await supabase
    .from("activities")
    .select("diver_id, date")
    .eq("dive_center_id", diveCenterId)
    .eq("status", "completed")
    .gte("date", yearStart)
    .lte("date", todayStr);

  const diverIds = [...new Set((activitiesRaw ?? []).map((a) => a.diver_id))];
  const { data: diversData } = diverIds.length
    ? await supabase.from("divers").select("id, nationality").in("id", diverIds)
    : { data: [] as { id: string; nationality: string | null }[] };
  const nationalityMap = new Map((diversData ?? []).map((d) => [d.id, d.nationality]));

  const counts = new Map<string, number>();
  diverIds.forEach((id) => {
    const label = nationalityMap.get(id)?.trim() || "Unspecified";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  const sorted = [...counts.entries()]
    .map(([nationality, count]) => ({ nationality, count }))
    .sort((a, b) => b.count - a.count);
  const top5 = sorted.slice(0, 5);
  const othersCount = sorted.slice(5).reduce((s, r) => s + r.count, 0);
  return othersCount > 0 ? [...top5, { nationality: "Others", count: othersCount }] : top5;
}

// ── Staff Activity Summary ──────────────────────────────────────────────
//
// "Leading Our Dives" now sources primarily from Scheduling's own staff
// *assignments* (schedule_divers + schedules), not just completed
// activities — a trip shows up here as soon as a guide is assigned in
// Phase 2, even before Boat Return creates any `activities` rows. This
// matches the request's own "assigned guide / assigned date" framing and
// covers instructors/freelancers leading fun dives (schedule_divers has no
// notion of staff *position*, so nothing here needs to special-case one).
// A second, smaller source — completed fun-diving `activities` rows with
// no linked schedule — is folded in as a fallback so a manually-added
// walk-in fun dive (never built through Scheduling) still shows up; the
// `schedule_id is null` filter on that fallback keeps it disjoint from the
// assignment-based rows (once a trip is Boat Returned its activities carry
// a real schedule_id, so it's never double-counted).
//
// "Our Dive Educators" stays activities-based (explicitly "Course
// activities only" per the request) but now produces one row per
// *student* per day, not one aggregated row per course — each row reads
// its own `activities.dive_rate` as "Rate Paid by Diver."
//
// Both sections persist Commission + Additional Rate as two independent
// manually-entered numbers (Total = their sum, never recomputed
// authoritatively from dive/diver counts — see saveDiveLeaderCommission/
// saveInstructorCommission in actions.ts) — a change from this table's
// earlier `dives × rate + bonus` formula. Each row is still its own
// persisted line item keyed by its real activity date (not a calendar-
// month bucket), so marking an arbitrary date range "paid" only touches
// entries actually in that range.

export type LeaderCommissionRow = {
  key: string;
  staffName: string;
  date: string;
  site: string;
  dives: number;
  divers: number;
  commissionAmount: number;
  additionalRate: number;
  total: number;
  status: "unpaid" | "paid";
  paymentMethod: "cash" | "card" | "online" | null;
  channel: PaymentChannel | null;
  // True once a matching row exists in staff_commission_records — false
  // means this row is only a live computation from schedule/activity data
  // (Round 7 Fix 3: gives the UI a way to flag rows that vanish/reset on
  // reload if nobody clicks Save/Mark as Paid first).
  isSaved: boolean;
};

export type EducatorCommissionRow = {
  key: string;
  staffName: string;
  date: string;
  diverId: string;
  diverName: string;
  course: string;
  ratePaidByDiver: number;
  commissionAmount: number;
  additionalRate: number;
  total: number;
  status: "unpaid" | "paid";
  paymentMethod: "cash" | "card" | "online" | null;
  channel: PaymentChannel | null;
  isSaved: boolean;
};

export type StaffActivityData = {
  divemasterRatePerDive: number;
  ratioBonusEnabled: boolean;
  ratioBonusExtraRate: number;
  leaderRows: LeaderCommissionRow[];
  educatorRows: EducatorCommissionRow[];
};

function splitSiteEntries(site: string | null): string[] {
  const parts = String(site ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Unnamed"];
}

export async function loadStaffActivityData(
  diveCenterId: string,
  dateFrom: string,
  dateTo: string,
): Promise<StaffActivityData> {
  const supabase = await createClient();

  const [{ data: dc }, { data: activitiesInRange }, { data: commissionRecords }, { data: schedulesInRange }] =
    await Promise.all([
      supabase
        .from("dive_centers")
        .select("divemaster_rate_per_dive, ratio_bonus_enabled, ratio_bonus_extra_rate")
        .eq("id", diveCenterId)
        .single(),
      supabase
        .from("activities")
        .select("diver_id, visit_id, date, dive_site, staff_name, status, schedule_id, dive_rate")
        .eq("dive_center_id", diveCenterId)
        .gte("date", dateFrom)
        .lte("date", dateTo),
      supabase
        .from("staff_commission_records")
        .select(
          "staff_name, commission_group, title, activity_date, diver_id, bonus_amount, commission_amount, status, payment_method, channel",
        )
        .eq("dive_center_id", diveCenterId)
        .gte("activity_date", dateFrom)
        .lte("activity_date", dateTo),
      supabase
        .from("schedules")
        .select("id, schedule_date")
        .eq("dive_center_id", diveCenterId)
        .eq("cancelled", false)
        .gte("schedule_date", dateFrom)
        .lte("schedule_date", dateTo),
    ]);

  const divemasterRatePerDive = Number(dc?.divemaster_rate_per_dive ?? 0);
  const ratioBonusEnabled = !!dc?.ratio_bonus_enabled;
  const ratioBonusExtraRate = Number(dc?.ratio_bonus_extra_rate ?? 0);

  const commissions = commissionRecords ?? [];
  function findExisting(
    group: "dive_leader" | "dive_educator",
    staffName: string,
    title: string,
    date: string,
    diverId: string | null,
  ) {
    return commissions.find(
      (r) =>
        r.commission_group === group &&
        r.staff_name === staffName &&
        r.title === title &&
        r.activity_date === date &&
        (group === "dive_leader" || r.diver_id === diverId),
    );
  }

  // ── Leading Our Dives: source 1 — Scheduling assignments ───────────────
  const scheduleMap = new Map((schedulesInRange ?? []).map((s) => [s.id, s.schedule_date]));
  const scheduleIds = [...scheduleMap.keys()];

  const [{ data: assignedDivers }, { data: siteRows }] = await Promise.all([
    scheduleIds.length
      ? supabase
          .from("schedule_divers")
          .select("schedule_id, diver_id, staff_id, staff_name")
          .eq("dive_center_id", diveCenterId)
          .eq("experience_type", "fun_diving")
          .in("schedule_id", scheduleIds)
      : Promise.resolve({
          data: [] as { schedule_id: string; diver_id: string; staff_id: string | null; staff_name: string | null }[],
        }),
    scheduleIds.length
      ? supabase
          .from("schedule_sites")
          .select("schedule_id, dive_site_id, sort_order")
          .in("schedule_id", scheduleIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as { schedule_id: string; dive_site_id: string; sort_order: number }[] }),
  ]);

  const diveSiteIds = [...new Set((siteRows ?? []).map((r) => r.dive_site_id))];
  const { data: diveSitesData } = diveSiteIds.length
    ? await supabase.from("dive_sites").select("id, site_name").in("id", diveSiteIds)
    : { data: [] as { id: string; site_name: string }[] };
  const diveSiteNameMap = new Map((diveSitesData ?? []).map((s) => [s.id, s.site_name]));

  const sitesByScheduleId = new Map<string, string[]>();
  (siteRows ?? []).forEach((r) => {
    const list = sitesByScheduleId.get(r.schedule_id) ?? [];
    list.push(diveSiteNameMap.get(r.dive_site_id) ?? "Unnamed");
    sitesByScheduleId.set(r.schedule_id, list);
  });

  const staffIds = [
    ...new Set((assignedDivers ?? []).map((r) => r.staff_id).filter((id): id is string => !!id)),
  ];
  const { data: staffData } = staffIds.length
    ? await supabase.from("staff").select("id, first_name, last_name").in("id", staffIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const staffNameMap = new Map(
    (staffData ?? []).map((s) => [s.id, `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Unassigned"]),
  );

  type LeaderGroup = { staffName: string; date: string; site: string; dives: number; divers: Set<string> };
  const leaderGroups = new Map<string, LeaderGroup>();

  (assignedDivers ?? []).forEach((row) => {
    const date = scheduleMap.get(row.schedule_id);
    if (!date) return;
    const staffName = row.staff_id
      ? (staffNameMap.get(row.staff_id) ?? "Unassigned")
      : row.staff_name?.trim() || "Unassigned";
    const sites = sitesByScheduleId.get(row.schedule_id) ?? [];
    const site = sites.length ? sites.join(", ") : "Unnamed";
    const dives = Math.max(1, sites.length);
    const key = `sched|${row.schedule_id}|${row.staff_id ?? staffName}`;
    const g = leaderGroups.get(key) ?? { staffName, date, site, dives, divers: new Set<string>() };
    g.divers.add(row.diver_id);
    leaderGroups.set(key, g);
  });

  // ── Leading Our Dives: source 2 — walk-in fallback (no linked schedule) ──
  const completed = (activitiesInRange ?? []).filter((a) => a.status === "completed");
  const visitIds = [...new Set(completed.map((a) => a.visit_id))];

  const { data: visitsData } = visitIds.length
    ? await supabase.from("visits").select("id, experience_type, course_rate_id").in("id", visitIds)
    : { data: [] as { id: string; experience_type: string; course_rate_id: string | null }[] };

  const courseRateIds = [
    ...new Set((visitsData ?? []).map((v) => v.course_rate_id).filter((id): id is string => !!id)),
  ];
  const { data: courseRatesData } = courseRateIds.length
    ? await supabase.from("course_rates").select("id, course_name").in("id", courseRateIds)
    : { data: [] as { id: string; course_name: string }[] };

  const visitMap = new Map((visitsData ?? []).map((v) => [v.id, v]));
  const courseNameMap = new Map((courseRatesData ?? []).map((c) => [c.id, c.course_name]));

  type WalkInGroup = { staffName: string; date: string; label: string; divers: Set<string>; rows: number };
  const walkInGroups = new Map<string, WalkInGroup>();
  type CourseGroup = { staffName: string; date: string; title: string; diverId: string; rate: number };
  const courseRows: CourseGroup[] = [];

  completed.forEach((a) => {
    const staffName = a.staff_name?.trim() || "Unassigned";
    const date = a.date;
    const visit = visitMap.get(a.visit_id);
    if (visit?.experience_type === "dive_course") {
      const title = (visit.course_rate_id && courseNameMap.get(visit.course_rate_id)) || "Course";
      courseRows.push({ staffName, date, title, diverId: a.diver_id, rate: safeNum(a.dive_rate) });
    } else if (!a.schedule_id) {
      const label = a.dive_site?.trim() || "Unnamed";
      const key = `manual|${staffName}|${date}|${label}`;
      const g = walkInGroups.get(key) ?? { staffName, date, label, divers: new Set<string>(), rows: 0 };
      g.divers.add(a.diver_id);
      g.rows += 1;
      walkInGroups.set(key, g);
    }
  });

  const leaderRows: LeaderCommissionRow[] = [
    ...[...leaderGroups.values()].map((g) => ({
      key: `dive_leader|sched|${g.staffName}|${g.date}|${g.site}`,
      staffName: g.staffName,
      date: g.date,
      site: g.site,
      dives: g.dives,
      divers: g.divers.size,
    })),
    ...[...walkInGroups.values()].map((g) => {
      const diverCount = Math.max(1, g.divers.size);
      const rowBased = Math.max(1, Math.round(g.rows / diverCount));
      const entryBased = Math.max(1, splitSiteEntries(g.label).length);
      return {
        key: `dive_leader|manual|${g.staffName}|${g.date}|${g.label}`,
        staffName: g.staffName,
        date: g.date,
        site: g.label,
        dives: Math.max(rowBased, entryBased),
        divers: g.divers.size,
      };
    }),
  ]
    .map((row) => {
      const existing = findExisting("dive_leader", row.staffName, row.site, row.date, null);
      const commissionAmount = existing ? safeNum(existing.commission_amount) : divemasterRatePerDive * row.dives;
      const additionalRate = existing
        ? safeNum(existing.bonus_amount)
        : ratioBonusEnabled && row.divers > 4
          ? ratioBonusExtraRate
          : 0;
      return {
        ...row,
        commissionAmount,
        additionalRate,
        total: commissionAmount + additionalRate,
        status: (existing?.status as "unpaid" | "paid") ?? "unpaid",
        paymentMethod: existing?.payment_method ?? null,
        channel: existing?.channel ?? null,
        isSaved: !!existing,
      };
    })
    .sort((a, b) => a.staffName.localeCompare(b.staffName) || a.date.localeCompare(b.date));

  // ── Our Dive Educators: one row per student per day ────────────────────
  const courseDiverIds = [...new Set(courseRows.map((r) => r.diverId))];
  const { data: courseDiversData } = courseDiverIds.length
    ? await supabase.from("divers").select("id, first_name, last_name").in("id", courseDiverIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const diverNameMap = new Map(
    (courseDiversData ?? []).map((d) => [d.id, `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || "Unknown"]),
  );

  const educatorGroups = new Map<
    string,
    { staffName: string; date: string; title: string; diverId: string; rate: number }
  >();
  courseRows.forEach((r) => {
    const key = `${r.staffName}|${r.date}|${r.title}|${r.diverId}`;
    if (!educatorGroups.has(key)) educatorGroups.set(key, r);
  });

  const educatorRows: EducatorCommissionRow[] = [...educatorGroups.values()]
    .map((g) => {
      const existing = findExisting("dive_educator", g.staffName, g.title, g.date, g.diverId);
      const commissionAmount = existing ? safeNum(existing.commission_amount) : 0;
      const additionalRate = existing ? safeNum(existing.bonus_amount) : 0;
      return {
        key: `dive_educator|${g.staffName}|${g.date}|${g.title}|${g.diverId}`,
        staffName: g.staffName,
        date: g.date,
        diverId: g.diverId,
        diverName: diverNameMap.get(g.diverId) ?? "Unknown",
        course: g.title,
        ratePaidByDiver: g.rate,
        commissionAmount,
        additionalRate,
        total: commissionAmount + additionalRate,
        status: (existing?.status as "unpaid" | "paid") ?? "unpaid",
        paymentMethod: existing?.payment_method ?? null,
        channel: existing?.channel ?? null,
        isSaved: !!existing,
      };
    })
    .sort((a, b) => a.staffName.localeCompare(b.staffName) || a.date.localeCompare(b.date));

  return {
    divemasterRatePerDive,
    ratioBonusEnabled,
    ratioBonusExtraRate,
    leaderRows,
    educatorRows,
  };
}

// ── Join Ride ────────────────────────────────────────────────────────────
//
// Cards are all-time balances (not date-range scoped), matching Overview's
// existing "Open Diver Bills" precedent — outstanding to-collect/to-pay
// money is a current-state concern, not something you'd want to lose sight
// of just because it fell outside the selected period. The records table
// itself is filtered by the applied date range, client-side, from the same
// unbounded fetch — no need to round-trip to the server on every date
// change since this table isn't expected to be huge.

export type JoinRideDirection = "joined_our_boat" | "we_joined_another_boat";

export type JoinRideRecord = {
  id: string;
  direction: JoinRideDirection;
  date: string;
  company: string;
  numberOfDivers: number;
  numberOfDives: number;
  diveSites: string | null;
  totalAmount: number;
  status: string;
  balance: number;
  remarks: string | null;
  paymentMethod: "cash" | "card" | "online" | null;
  channel: PaymentChannel | null;
};

export type JoinRideData = {
  diveCenterName: string;
  joinRideRatePerDiverPerDive: number;
  records: JoinRideRecord[];
};

export async function loadJoinRideData(diveCenterId: string): Promise<JoinRideData> {
  const supabase = await createClient();

  const [{ data: dc }, { data: records }] = await Promise.all([
    supabase
      .from("dive_centers")
      .select("name, join_ride_rate_per_diver_per_dive")
      .eq("id", diveCenterId)
      .single(),
    supabase
      .from("join_ride_records")
      .select(
        "id, direction, date, company, number_of_divers, number_of_dives, dive_sites, total_amount, status, balance, remarks, payment_method, channel",
      )
      .eq("dive_center_id", diveCenterId)
      .order("date", { ascending: false }),
  ]);

  return {
    diveCenterName: dc?.name ?? "Dive Center",
    joinRideRatePerDiverPerDive: Number(dc?.join_ride_rate_per_diver_per_dive ?? 0),
    records: (records ?? []).map((r) => ({
      id: r.id,
      direction: r.direction as JoinRideDirection,
      date: r.date,
      company: r.company,
      numberOfDivers: r.number_of_divers ?? 0,
      numberOfDives: r.number_of_dives ?? 0,
      diveSites: r.dive_sites,
      totalAmount: safeNum(r.total_amount),
      status: r.status,
      balance: safeNum(r.balance),
      remarks: r.remarks,
      paymentMethod: r.payment_method,
      channel: r.channel,
    })),
  };
}

// ── Rental Gears ─────────────────────────────────────────────────────────
//
// Same all-time-cards / date-filtered-table split as Join Ride, and for the
// same reason — "still to collect" / "still to pay" is a current-balance
// concern, not something that should disappear from view just because it
// falls outside the selected date range.

export type RentalGearRecord = {
  id: string;
  date: string;
  equipment: string;
  company: string | null;
  quantity: number;
  rate: number;
  totalAmount: number;
  status: string;
  balance: number;
  remarks: string | null;
  paymentMethod: "cash" | "card" | "online" | null;
  channel: PaymentChannel | null;
};

export type RentalGearsData = {
  records: RentalGearRecord[];
};

export async function loadRentalGearsData(diveCenterId: string): Promise<RentalGearsData> {
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("rental_gear_records")
    .select("id, date, equipment, company, quantity, rate, total_amount, status, balance, remarks, payment_method, channel")
    .eq("dive_center_id", diveCenterId)
    .order("date", { ascending: false });

  return {
    records: (records ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      equipment: r.equipment,
      company: r.company,
      quantity: r.quantity ?? 0,
      rate: safeNum(r.rate),
      totalAmount: safeNum(r.total_amount),
      status: r.status,
      balance: safeNum(r.balance),
      remarks: r.remarks,
      paymentMethod: r.payment_method,
      channel: r.channel,
    })),
  };
}

// ── Expenses ─────────────────────────────────────────────────────────────
//
// Unlike Join Ride / Rental Gears, this is a plain log with no pending-
// balance concept — every figure here is meant to be read within the
// selected period, so (matching the live app) the fetch itself is date-
// range scoped server-side rather than fetched once unbounded. Expenses
// can also accumulate far more rows over a dive center's lifetime than
// occasional rental/join-ride transactions, so this scales better too.

export type ExpenseRecord = {
  id: string;
  date: string;
  category: string;
  customCategory: string | null;
  amount: number;
  paymentMethod: string | null;
  channel: PaymentChannel | null;
  recordedBy: string;
  notes: string | null;
};

export type ExpensesData = {
  records: ExpenseRecord[];
  categoryTotals: { name: string; amount: number }[];
  totalAmount: number;
  uncategorizedAmount: number;
};

// ── Settlement ───────────────────────────────────────────────────────────
//
// A single-date cash-drawer reconciliation, not a date-range report — one
// row per payment collected that day (plus deposit rows, highlighted, with
// their totals zeroed since a deposit isn't "collected" revenue yet) and a
// grand-total footer. "Closed By" resolves through invoice_emails.sent_by →
// users.full_name, taking the most recently sent invoice per visit.

export type SettlementRow = {
  date: string;
  diverId: string;
  diverName: string;
  closedBy: string;
  cashPHP: number;
  foreign: string;
  foreignPHP: number;
  card: number;
  cardSurcharge: number;
  online: number;
  onlineChannel: PaymentChannel | null;
  onlineSurcharge: number;
  totalCollected: number;
  excessAmount: number;
  isDeposit: boolean;
};

export type SettlementData = {
  diveCenterName: string;
  date: string;
  rows: SettlementRow[];
};

export async function loadSettlementData(diveCenterId: string, date: string): Promise<SettlementData> {
  const supabase = await createClient();
  const { startIso: dayStart, endIso: dayEnd } = manilaDayBoundsUtcIso(date);

  const [{ data: dc }, { data: paymentsRaw }, { data: depositsRaw }] = await Promise.all([
    supabase.from("dive_centers").select("name").eq("id", diveCenterId).single(),
    supabase
      .from("payments")
      .select(
        "paid_at, created_at, diver_id, visit_id, cash_amount, cash_amount_foreign, cash_currency_code, cash_exchange_rate, card_amount, card_surcharge_amount, online_amount, online_channel, online_surcharge_amount, total_collected, excess_amount",
      )
      .eq("dive_center_id", diveCenterId)
      .gte("paid_at", dayStart)
      .lte("paid_at", dayEnd)
      .order("paid_at", { ascending: true }),
    supabase
      .from("deposits")
      .select("deposit_date, diver_id, amount, method, channel, received_by")
      .eq("dive_center_id", diveCenterId)
      .eq("deposit_date", date)
      .order("created_at", { ascending: true }),
  ]);

  const payments = paymentsRaw ?? [];
  const deposits = depositsRaw ?? [];

  const diverIds = [...new Set([...payments.map((p) => p.diver_id), ...deposits.map((d) => d.diver_id)].filter(Boolean))];
  const visitIds = [...new Set(payments.map((p) => p.visit_id).filter(Boolean))];

  const [{ data: diversData }, { data: invoiceEmails }] = await Promise.all([
    diverIds.length
      ? supabase.from("divers").select("id, first_name, last_name").in("id", diverIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
    visitIds.length
      ? supabase
          .from("invoice_emails")
          .select("visit_id, sent_by")
          .in("visit_id", visitIds)
          .order("sent_at", { ascending: false })
      : Promise.resolve({ data: [] as { visit_id: string; sent_by: string | null }[] }),
  ]);

  const diverMap = new Map(
    (diversData ?? []).map((d) => [d.id, `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || "—"]),
  );

  const senderIds = [...new Set((invoiceEmails ?? []).map((ie) => ie.sent_by).filter((id): id is string => !!id))];
  const { data: usersData } = senderIds.length
    ? await supabase.from("users").select("id, full_name").in("id", senderIds)
    : { data: [] as { id: string; full_name: string }[] };
  const userMap = new Map((usersData ?? []).map((u) => [u.id, u.full_name]));

  // Most recently sent invoice per visit resolves "Closed By" — invoiceEmails
  // is already ordered sent_at desc, so the first hit per visit_id wins.
  const closedByMap = new Map<string, string>();
  (invoiceEmails ?? []).forEach((ie) => {
    if (!closedByMap.has(ie.visit_id)) {
      closedByMap.set(ie.visit_id, (ie.sent_by && userMap.get(ie.sent_by)) || "—");
    }
  });

  const paymentRows: SettlementRow[] = payments.map((p) => {
    const foreignPHP =
      p.cash_amount_foreign != null && p.cash_exchange_rate != null
        ? safeNum(p.cash_amount_foreign) * safeNum(p.cash_exchange_rate)
        : 0;
    const foreign =
      p.cash_amount_foreign != null && p.cash_currency_code
        ? `${safeNum(p.cash_amount_foreign).toLocaleString()} ${p.cash_currency_code} × ₱${safeNum(p.cash_exchange_rate).toLocaleString()}`
        : "";
    return {
      // Every row here is already guaranteed to fall within the selected
      // Manila calendar day (the query above filters on that basis) — use
      // that literal date directly rather than slicing paid_at's raw UTC
      // ISO string, which could show the previous/next calendar day for
      // an early-morning Manila payment and make the printed
      // reconciliation sheet look like it's missing/misdating a row.
      date,
      diverId: p.diver_id,
      diverName: diverMap.get(p.diver_id) ?? "—",
      closedBy: closedByMap.get(p.visit_id) ?? "—",
      cashPHP: safeNum(p.cash_amount),
      foreign,
      foreignPHP,
      card: safeNum(p.card_amount),
      cardSurcharge: safeNum(p.card_surcharge_amount),
      online: safeNum(p.online_amount),
      onlineChannel: p.online_channel,
      onlineSurcharge: safeNum(p.online_surcharge_amount),
      totalCollected: safeNum(p.total_collected),
      excessAmount: safeNum(p.excess_amount),
      isDeposit: false,
    };
  });

  const depositRows: SettlementRow[] = deposits.map((d) => ({
    date: String(d.deposit_date),
    diverId: d.diver_id,
    diverName: diverMap.get(d.diver_id) ?? "—",
    closedBy: d.received_by || "—",
    cashPHP: d.method === "cash" ? safeNum(d.amount) : 0,
    foreign: "",
    foreignPHP: 0,
    card: d.method === "card" ? safeNum(d.amount) : 0,
    cardSurcharge: 0,
    online: d.method === "online" ? safeNum(d.amount) : 0,
    onlineChannel: d.method === "online" ? d.channel : null,
    onlineSurcharge: 0,
    totalCollected: 0,
    excessAmount: 0,
    isDeposit: true,
  }));

  const rows = [...paymentRows, ...depositRows].sort((a, b) => a.date.localeCompare(b.date));

  return {
    diveCenterName: dc?.name ?? "Dive Center",
    date,
    rows,
  };
}

// ── Raw Data Export: Divers (one row per payment) ───────────────────────
//
// Only used by the Reports > Export Raw Data action — not shown anywhere
// on-screen. Unlike Settlement (one calendar day), this covers the
// Reports page's whole selected date range. A `payments` row can carry
// cash, card, and online amounts all at once (a split-paid bill), so each
// nonzero method on a row becomes its own output row — "one row per
// payment" means one row per amount actually collected, not one row per
// bill. Payment Channel is populated for every row (a literal "Cash"/
// "Card" for those methods, the real channel for Online) so the column
// reads on its own without cross-referencing Payment Method.

export type DiverPaymentExportRow = {
  date: string;
  traceNumber: string;
  diverName: string;
  amount: number;
  paymentMethod: "Cash" | "Card" | "Online";
  paymentChannel: string;
  notes: string;
};

export async function loadDiverPaymentsExport(
  diveCenterId: string,
  dateFrom: string,
  dateTo: string,
): Promise<DiverPaymentExportRow[]> {
  const supabase = await createClient();
  const { startIso, endIso } = { startIso: manilaDayBoundsUtcIso(dateFrom).startIso, endIso: manilaDayBoundsUtcIso(dateTo).endIso };

  const [{ data: paymentsRaw }, { data: depositsRaw }] = await Promise.all([
    supabase
      .from("payments")
      .select("paid_at, diver_id, cash_amount, card_amount, online_amount, online_channel, notes")
      .eq("dive_center_id", diveCenterId)
      .gte("paid_at", startIso)
      .lte("paid_at", endIso)
      .order("paid_at", { ascending: true }),
    supabase
      .from("deposits")
      .select("deposit_date, diver_id, amount, method, channel")
      .eq("dive_center_id", diveCenterId)
      .gte("deposit_date", dateFrom)
      .lte("deposit_date", dateTo)
      .order("deposit_date", { ascending: true }),
  ]);

  const payments = paymentsRaw ?? [];
  const deposits = depositsRaw ?? [];

  const diverIds = [...new Set([...payments.map((p) => p.diver_id), ...deposits.map((d) => d.diver_id)].filter(Boolean))];
  const { data: diversData } = diverIds.length
    ? await supabase.from("divers").select("id, first_name, last_name, trace_number").in("id", diverIds)
    : { data: [] as { id: string; first_name: string; last_name: string; trace_number: string | null }[] };
  const diverMap = new Map(
    (diversData ?? []).map((d) => [d.id, `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || "Unknown Diver"]),
  );
  const traceMap = new Map((diversData ?? []).map((d) => [d.id, d.trace_number ?? ""]));

  function channelLabel(method: "cash" | "card" | "online", channel: PaymentChannel | null): string {
    if (method === "cash") return "Cash";
    if (method === "card") return "Card";
    return channel ? PAYMENT_CHANNEL_LABELS[channel] : "Online";
  }

  const rows: DiverPaymentExportRow[] = [];

  payments.forEach((p) => {
    const date = manilaDateFromIso(p.paid_at);
    const diverName = diverMap.get(p.diver_id) ?? "Unknown Diver";
    const traceNumber = traceMap.get(p.diver_id) ?? "";
    const notes = p.notes ?? "";
    if (safeNum(p.cash_amount) > 0) {
      rows.push({ date, traceNumber, diverName, amount: safeNum(p.cash_amount), paymentMethod: "Cash", paymentChannel: "Cash", notes });
    }
    if (safeNum(p.card_amount) > 0) {
      rows.push({ date, traceNumber, diverName, amount: safeNum(p.card_amount), paymentMethod: "Card", paymentChannel: "Card", notes });
    }
    if (safeNum(p.online_amount) > 0) {
      rows.push({
        date,
        traceNumber,
        diverName,
        amount: safeNum(p.online_amount),
        paymentMethod: "Online",
        paymentChannel: channelLabel("online", p.online_channel),
        notes,
      });
    }
  });

  deposits.forEach((d) => {
    const method = d.method as "cash" | "card" | "online";
    rows.push({
      date: String(d.deposit_date),
      traceNumber: traceMap.get(d.diver_id) ?? "",
      diverName: diverMap.get(d.diver_id) ?? "Unknown Diver",
      amount: safeNum(d.amount),
      paymentMethod: method === "cash" ? "Cash" : method === "card" ? "Card" : "Online",
      paymentChannel: channelLabel(method, d.channel),
      notes: "",
    });
  });

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadExpensesData(
  diveCenterId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ExpensesData> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("expenses")
    .select("id, date, category, custom_category, amount, payment_method, channel, notes, created_by")
    .eq("dive_center_id", diveCenterId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: false });

  // "Recorded By" — same batch-join-to-a-Map pattern as diver notes /
  // Settlement's "Closed By", not a Supabase embedded-relationship select
  // (see the ambiguous-FK PGRST201 lesson elsewhere in this codebase).
  const recorderIds = [...new Set((rows ?? []).map((r) => r.created_by).filter((id): id is string => !!id))];
  const { data: usersData } = recorderIds.length
    ? await supabase.from("users").select("id, full_name").in("id", recorderIds)
    : { data: [] as { id: string; full_name: string }[] };
  const userMap = new Map((usersData ?? []).map((u) => [u.id, u.full_name]));

  const records: ExpenseRecord[] = (rows ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    category: r.category,
    customCategory: r.custom_category,
    amount: safeNum(r.amount),
    paymentMethod: r.payment_method,
    channel: r.channel,
    recordedBy: (r.created_by && userMap.get(r.created_by)) || "—",
    notes: r.notes,
  }));

  const categoryMap = new Map<string, number>();
  let uncategorizedAmount = 0;
  records.forEach((r) => {
    const label = expenseGroupLabel(r.category, r.customCategory);
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + r.amount);
    if (label === "Uncategorized" || label === "Other (unspecified)") {
      uncategorizedAmount += r.amount;
    }
  });
  const categoryTotals = [...categoryMap.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    records,
    categoryTotals,
    totalAmount: records.reduce((s, r) => s + r.amount, 0),
    uncategorizedAmount,
  };
}

// ── Government Fees ─────────────────────────────────────────────────────
//
// Date-range scoped like Expenses (the live app's govt-fees log reads the
// same shared From/To picker via its monthStart()/monthEnd() helpers,
// which are just aliases for those two inputs — not a separate range).
// Schema was originally shaped wrong (a rate-config table) and fixed in
// migration 006 to the live app's real daily-log shape; see that file's
// comment for the full story.

export type GovtFeeType = "Marine Fee" | "Shark Fee" | "Other Fee";

export type GovtFeeRecord = {
  id: string;
  date: string;
  feeType: GovtFeeType;
  rate: number;
  divers: number;
  total: number;
};

export type GovtFeesData = {
  records: GovtFeeRecord[];
};

export async function loadGovtFeesData(
  diveCenterId: string,
  dateFrom: string,
  dateTo: string,
): Promise<GovtFeesData> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("govt_fees")
    .select("id, date, fee_type, rate, divers, total")
    .eq("dive_center_id", diveCenterId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true });

  return {
    records: (rows ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      feeType: r.fee_type as GovtFeeType,
      rate: safeNum(r.rate),
      divers: r.divers ?? 0,
      total: safeNum(r.total),
    })),
  };
}

// ── Billing Audit ────────────────────────────────────────────────────────
//
// Unbounded, not date-range scoped (the live app loads all of it once and
// caches with an `auditLoaded` flag, same shape as Join Ride/Rental Gears
// here). "Flagged" = a visit with more than one invoice ever sent for it —
// a sign charges may have changed after a bill was already closed. Every
// invoice's totals/line-items are read from `invoice_emails.invoice_snapshot`
// (a jsonb capture taken at send time). The real shape is now confirmed —
// Diver Detail's checkoutVisit action (src/app/(app)/divers/[id]/actions.ts)
// is the only writer, and it always writes `grand_total` (snake_case) — the
// old defensive `grandTotal`/`total` fallback keys were guesses against the
// pre-Diver-Detail unknown shape and are now dead, removed below.

export type AuditInvoiceRow = {
  id: string;
  visitId: string;
  diverId: string;
  diverName: string;
  diverEmail: string;
  diverNationality: string | null;
  sentAt: string;
  closedBy: string;
  totalBilled: number;
  snapshot: Record<string, unknown>;
};

export type AuditFlaggedVisit = {
  visitId: string;
  diverId: string;
  diverName: string;
  diverEmail: string;
  invoiceCount: number;
  invoices: AuditInvoiceRow[];
};

export type AuditUnlockLog = {
  id: string;
  label: string;
  unlockedBy: string;
  unlockedAt: string;
  notes: string;
};

export type BillingAuditData = {
  diveCenterName: string;
  flagged: AuditFlaggedVisit[];
  invoices: AuditInvoiceRow[];
  unlocks: AuditUnlockLog[];
};

export async function loadBillingAuditData(diveCenterId: string): Promise<BillingAuditData> {
  const supabase = await createClient();

  const [{ data: dc }, { data: visitsRaw }, { data: invoiceEmailsRaw }, { data: unlockLogsRaw }] = await Promise.all([
    supabase.from("dive_centers").select("name").eq("id", diveCenterId).single(),
    supabase
      .from("visits")
      .select("id, diver_id, invoice_count")
      .eq("dive_center_id", diveCenterId)
      .gt("invoice_count", 0),
    supabase
      .from("invoice_emails")
      .select("id, visit_id, diver_id, sent_at, sent_by, invoice_snapshot")
      .eq("dive_center_id", diveCenterId)
      .order("sent_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("id, performed_by, target_id, notes, created_at")
      .eq("dive_center_id", diveCenterId)
      .eq("action", "bill_unlocked")
      .order("created_at", { ascending: false }),
  ]);

  const visits = visitsRaw ?? [];
  const invoiceEmails = invoiceEmailsRaw ?? [];
  const unlockLogs = unlockLogsRaw ?? [];

  const diverIds = [...new Set([...visits.map((v) => v.diver_id), ...invoiceEmails.map((i) => i.diver_id)].filter(Boolean))];
  const userIds = [
    ...new Set(
      [...invoiceEmails.map((i) => i.sent_by), ...unlockLogs.map((l) => l.performed_by)].filter(
        (id): id is string => !!id,
      ),
    ),
  ];

  const [{ data: diversData }, { data: usersData }] = await Promise.all([
    diverIds.length
      ? supabase.from("divers").select("id, first_name, last_name, email, nationality").in("id", diverIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; email: string | null; nationality: string | null }[] }),
    userIds.length
      ? supabase.from("users").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const diverMap = new Map((diversData ?? []).map((d) => [d.id, d]));
  const userMap = new Map((usersData ?? []).map((u) => [u.id, u.full_name]));

  function diverName(id: string): string {
    const d = diverMap.get(id);
    return d ? `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || "Unknown Diver" : "Unknown Diver";
  }
  function diverEmail(id: string): string {
    return diverMap.get(id)?.email || "—";
  }

  const invoices: AuditInvoiceRow[] = invoiceEmails.map((inv) => {
    const snap = (inv.invoice_snapshot ?? {}) as Record<string, unknown>;
    const total = safeNum(snap.grand_total);
    return {
      id: inv.id,
      visitId: inv.visit_id,
      diverId: inv.diver_id,
      diverName: diverName(inv.diver_id),
      diverEmail: diverEmail(inv.diver_id),
      diverNationality: diverMap.get(inv.diver_id)?.nationality ?? null,
      sentAt: inv.sent_at,
      closedBy: (inv.sent_by && userMap.get(inv.sent_by)) || "—",
      totalBilled: total,
      snapshot: snap,
    };
  });

  const invoicesByVisit = new Map<string, AuditInvoiceRow[]>();
  invoices.forEach((inv) => {
    const list = invoicesByVisit.get(inv.visitId) ?? [];
    list.push(inv);
    invoicesByVisit.set(inv.visitId, list);
  });

  const flagged: AuditFlaggedVisit[] = visits
    .filter((v) => (v.invoice_count ?? 0) > 1)
    .map((v) => ({
      visitId: v.id,
      diverId: v.diver_id,
      diverName: diverName(v.diver_id),
      diverEmail: diverEmail(v.diver_id),
      invoiceCount: v.invoice_count ?? 0,
      invoices: invoicesByVisit.get(v.id) ?? [],
    }));

  const unlocks: AuditUnlockLog[] = unlockLogs.map((log) => {
    const notes = log.notes || "—";
    return {
      id: log.id,
      label: notes.split("—")[0]?.trim() || notes,
      unlockedBy: (log.performed_by && userMap.get(log.performed_by)) || "—",
      unlockedAt: log.created_at,
      notes,
    };
  });

  return { diveCenterName: dc?.name ?? "Dive Center", flagged, invoices, unlocks };
}
