import "server-only";
import { createClient } from "@/lib/supabase/server";
import { safeNum, getPaidAmount } from "@/lib/payments";
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

function splitDiveSites(site: string | null): string[] {
  const parts = String(site ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Unnamed"];
}

function expenseGroupLabel(category: string, customCategory: string | null): string {
  if (category === "other") {
    const custom = customCategory?.trim();
    return custom ? `Other – ${custom}` : "Other (unspecified)";
  }
  return EXPENSE_CATEGORY_LABELS[category] ?? "Uncategorized";
}

export type SiteActivity = { name: string; count: number };

export type BusinessSummary = {
  moneyIn: number;
  collectedFromDivers: number;
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
  completedDives: number;
  summary: BusinessSummary;
  topSites: SiteActivity[];
  expenseCategoryTotals: { name: string; amount: number }[];
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
      .select("diver_id, dive_site, status, visit_id")
      .eq("dive_center_id", diveCenterId)
      .gte("date", dateFrom)
      .lte("date", dateTo),
    supabase
      .from("payments")
      .select(
        "cash_amount, cash_amount_foreign, cash_exchange_rate, card_amount, card_surcharge_amount, online_amount, online_surcharge_amount",
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
      .select("status, commission_amount")
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

  // ── Dive site activity + served/completed counts ──────────────────────
  const completedActivities = (activitiesInRange ?? []).filter(
    (a) => a.status === "completed",
  );
  const siteMap = new Map<string, number>();
  completedActivities.forEach((a) => {
    splitDiveSites(a.dive_site).forEach((site) => {
      siteMap.set(site, (siteMap.get(site) ?? 0) + 1);
    });
  });
  const topSites: SiteActivity[] = [...siteMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const divesServed = new Set(completedActivities.map((a) => a.diver_id)).size;

  // ── Collected from divers (money actually received in range) ──────────
  const collectedFromDivers = (paymentsInRange ?? []).reduce(
    (sum, p) =>
      sum +
      safeNum(p.cash_amount) +
      safeNum(p.cash_amount_foreign) * safeNum(p.cash_exchange_rate) +
      safeNum(p.card_amount) +
      safeNum(p.card_surcharge_amount) +
      safeNum(p.online_amount) +
      safeNum(p.online_surcharge_amount),
    0,
  );

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
  const commissions = commissionRecords ?? [];
  const commissionsPaid = commissions
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + safeNum(r.commission_amount), 0);
  const unpaidCommissions = commissions
    .filter((r) => r.status !== "paid")
    .reduce((s, r) => s + safeNum(r.commission_amount), 0);

  // ── Expenses ────────────────────────────────────────────────────────────
  const expenses = expensesInRange ?? [];
  const expenseTotal = expenses.reduce((s, r) => s + safeNum(r.amount), 0);
  const expenseCatMap = new Map<string, number>();
  expenses.forEach((r) => {
    const label = expenseGroupLabel(r.category, r.custom_category);
    expenseCatMap.set(label, (expenseCatMap.get(label) ?? 0) + safeNum(r.amount));
  });
  const expenseCategoryTotals = [...expenseCatMap.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

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
    completedDives: completedActivities.length,
    summary: {
      moneyIn,
      collectedFromDivers,
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
    topSites,
    expenseCategoryTotals,
  };
}

// ── Staff Activity Summary ──────────────────────────────────────────────
//
// Commission quantities need an "actual dive count", not a diver headcount:
// `activities` has one row per diver per dive, so a boat of 5 divers on one
// dive produces 5 rows sharing the same staff/date/site. Reconciling that
// back to "how many dives did this guide actually lead" needs the same
// row-count/diver-count heuristic the live app used (see CLAUDE.md) — that
// part of the live app's complexity is inherent to the schema, not just
// messy legacy data. What the live app *didn't* have was a reliable way to
// tell a course activity from a fun dive, so it fell back to guessing from
// several loosely-related text fields. Here that's a clean lookup via
// `visits.experience_type`, which every activity's visit inherits.
//
// Unlike the live app (one paid/unpaid status per staff per calendar
// month), each dive-group or course-group here is its own persisted line
// item keyed by its real activity date — that's what lets a secretary mark
// an arbitrary date range "paid" without touching entries outside it.

export type LeaderCommissionRow = {
  key: string;
  staffName: string;
  date: string;
  site: string;
  dives: number;
  divers: number;
  rate: number;
  bonusAmount: number;
  amount: number;
  status: "unpaid" | "paid";
};

export type EducatorCommissionRow = {
  key: string;
  staffName: string;
  date: string;
  course: string;
  students: number;
  amount: number;
  status: "unpaid" | "paid";
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

  const [{ data: dc }, { data: activitiesInRange }, { data: commissionRecords }] = await Promise.all([
    supabase
      .from("dive_centers")
      .select("divemaster_rate_per_dive, ratio_bonus_enabled, ratio_bonus_extra_rate")
      .eq("id", diveCenterId)
      .single(),
    supabase
      .from("activities")
      .select("diver_id, visit_id, date, dive_site, staff_name, status, schedule_id")
      .eq("dive_center_id", diveCenterId)
      .gte("date", dateFrom)
      .lte("date", dateTo),
    supabase
      .from("staff_commission_records")
      .select("staff_name, commission_group, title, activity_date, rate, bonus_amount, commission_amount, status")
      .eq("dive_center_id", diveCenterId)
      .gte("activity_date", dateFrom)
      .lte("activity_date", dateTo),
  ]);

  const divemasterRatePerDive = Number(dc?.divemaster_rate_per_dive ?? 0);
  const ratioBonusEnabled = !!dc?.ratio_bonus_enabled;
  const ratioBonusExtraRate = Number(dc?.ratio_bonus_extra_rate ?? 0);

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

  type FunGroup = { staffName: string; date: string; label: string; divers: Set<string>; rows: number };
  type CourseGroup = { staffName: string; date: string; title: string; divers: Set<string> };
  const funGroups = new Map<string, FunGroup>();
  const courseGroups = new Map<string, CourseGroup>();

  completed.forEach((a) => {
    const staffName = a.staff_name?.trim() || "Unassigned";
    const date = a.date;
    const visit = visitMap.get(a.visit_id);
    if (visit?.experience_type === "dive_course") {
      const title = (visit.course_rate_id && courseNameMap.get(visit.course_rate_id)) || "Course";
      const key = `${staffName}|${date}|${title}`;
      const g = courseGroups.get(key) ?? { staffName, date, title, divers: new Set<string>() };
      g.divers.add(a.diver_id);
      courseGroups.set(key, g);
    } else {
      const label = a.dive_site?.trim() || "Unnamed";
      const key = `${staffName}|${date}|${a.schedule_id ?? "manual"}|${label}`;
      const g = funGroups.get(key) ?? { staffName, date, label, divers: new Set<string>(), rows: 0 };
      g.divers.add(a.diver_id);
      g.rows += 1;
      funGroups.set(key, g);
    }
  });

  const commissions = commissionRecords ?? [];
  function findExisting(group: "dive_leader" | "dive_educator", staffName: string, title: string, date: string) {
    return commissions.find(
      (r) =>
        r.commission_group === group &&
        r.staff_name === staffName &&
        r.title === title &&
        r.activity_date === date,
    );
  }

  const leaderRows: LeaderCommissionRow[] = [...funGroups.values()]
    .map((g) => {
      const diverCount = Math.max(1, g.divers.size);
      const rowBased = Math.max(1, Math.round(g.rows / diverCount));
      const entryBased = Math.max(1, splitSiteEntries(g.label).length);
      const dives = Math.max(rowBased, entryBased);
      const divers = g.divers.size;

      const existing = findExisting("dive_leader", g.staffName, g.label, g.date);
      const rate = existing ? safeNum(existing.rate) : divemasterRatePerDive;
      const bonusAmount = existing
        ? safeNum(existing.bonus_amount)
        : ratioBonusEnabled && divers > 4
          ? ratioBonusExtraRate
          : 0;

      return {
        key: `dive_leader|${g.staffName}|${g.date}|${g.label}`,
        staffName: g.staffName,
        date: g.date,
        site: g.label,
        dives,
        divers,
        rate,
        bonusAmount,
        amount: dives * rate + bonusAmount,
        status: (existing?.status as "unpaid" | "paid") ?? "unpaid",
      };
    })
    .sort((a, b) => a.staffName.localeCompare(b.staffName) || a.date.localeCompare(b.date));

  const educatorRows: EducatorCommissionRow[] = [...courseGroups.values()]
    .map((g) => {
      const students = Math.max(1, g.divers.size);
      const existing = findExisting("dive_educator", g.staffName, g.title, g.date);
      return {
        key: `dive_educator|${g.staffName}|${g.date}|${g.title}`,
        staffName: g.staffName,
        date: g.date,
        course: g.title,
        students,
        amount: existing ? safeNum(existing.commission_amount) : 0,
        status: (existing?.status as "unpaid" | "paid") ?? "unpaid",
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
        "id, direction, date, company, number_of_divers, number_of_dives, dive_sites, total_amount, status, balance, remarks",
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
};

export type RentalGearsData = {
  records: RentalGearRecord[];
};

export async function loadRentalGearsData(diveCenterId: string): Promise<RentalGearsData> {
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("rental_gear_records")
    .select("id, date, equipment, company, quantity, rate, total_amount, status, balance, remarks")
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
  paidBy: string | null;
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
  diverName: string;
  closedBy: string;
  cashPHP: number;
  foreign: string;
  foreignPHP: number;
  card: number;
  cardSurcharge: number;
  online: number;
  onlineSurcharge: number;
  totalCollected: number;
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
        "paid_at, created_at, diver_id, visit_id, cash_amount, cash_amount_foreign, cash_currency_code, cash_exchange_rate, card_amount, card_surcharge_amount, online_amount, online_surcharge_amount, total_collected",
      )
      .eq("dive_center_id", diveCenterId)
      .gte("paid_at", dayStart)
      .lte("paid_at", dayEnd)
      .order("paid_at", { ascending: true }),
    supabase
      .from("deposits")
      .select("deposit_date, diver_id, amount, method, received_by")
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
      diverName: diverMap.get(p.diver_id) ?? "—",
      closedBy: closedByMap.get(p.visit_id) ?? "—",
      cashPHP: safeNum(p.cash_amount),
      foreign,
      foreignPHP,
      card: safeNum(p.card_amount),
      cardSurcharge: safeNum(p.card_surcharge_amount),
      online: safeNum(p.online_amount),
      onlineSurcharge: safeNum(p.online_surcharge_amount),
      totalCollected: safeNum(p.total_collected),
      isDeposit: false,
    };
  });

  const depositRows: SettlementRow[] = deposits.map((d) => ({
    date: String(d.deposit_date),
    diverName: diverMap.get(d.diver_id) ?? "—",
    closedBy: d.received_by || "—",
    cashPHP: d.method === "cash" ? safeNum(d.amount) : 0,
    foreign: "",
    foreignPHP: 0,
    card: d.method === "card" ? safeNum(d.amount) : 0,
    cardSurcharge: 0,
    online: d.method === "online" ? safeNum(d.amount) : 0,
    onlineSurcharge: 0,
    totalCollected: 0,
    isDeposit: true,
  }));

  const rows = [...paymentRows, ...depositRows].sort((a, b) => a.date.localeCompare(b.date));

  return {
    diveCenterName: dc?.name ?? "Dive Center",
    date,
    rows,
  };
}

export async function loadExpensesData(
  diveCenterId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ExpensesData> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("expenses")
    .select("id, date, category, custom_category, amount, paid_by, notes")
    .eq("dive_center_id", diveCenterId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: false });

  const records: ExpenseRecord[] = (rows ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    category: r.category,
    customCategory: r.custom_category,
    amount: safeNum(r.amount),
    paidBy: r.paid_by,
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
