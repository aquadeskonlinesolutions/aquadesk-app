import "server-only";
import { createClient } from "@/lib/supabase/server";
import { safeNum, getPaidAmount } from "@/lib/payments";

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  fuel: "Fuel",
  boat_maintenance: "Boat Maintenance",
  equipment_maintenance: "Equipment Maintenance",
  compressor_fill_station: "Compressor / Fill Station",
  staff_meals: "Staff Meals",
  food_expenses: "Food Expenses",
  office_supplies: "Office Supplies",
  utilities: "Utilities",
  licenses_permits: "Licenses & Permits",
  marketing: "Marketing",
  repairs: "Repairs",
  other: "Other",
  uncategorized: "Uncategorized",
};

function splitDiveSites(site: string | null): string[] {
  const parts = String(site ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Unnamed"];
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
      .gte("paid_at", `${dateFrom}T00:00:00.000Z`)
      .lte("paid_at", `${dateTo}T23:59:59.999Z`),
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
    const label =
      r.category === "other"
        ? r.custom_category?.trim()
          ? `Other – ${r.custom_category.trim()}`
          : "Other (unspecified)"
        : (EXPENSE_CATEGORY_LABELS[r.category] ?? "Uncategorized");
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
