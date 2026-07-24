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

function periodMonth(dateFrom: string): string {
  return dateFrom.slice(0, 7);
}

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
      .eq("period_month", periodMonth(dateFrom)),
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

  // ── Staff commissions (current calendar month only, matching the live app) ─
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
