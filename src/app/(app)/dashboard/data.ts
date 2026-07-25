import "server-only";
import { createClient } from "@/lib/supabase/server";
import { safeNum, getPaidAmount } from "@/lib/payments";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// AquaDesk's dive centers operate in the Philippines. "Today"/"tomorrow" for
// alerts and revenue must be anchored to Asia/Manila regardless of what
// timezone the server process happens to run in, or a UTC-based server would
// roll the business day over 8 hours early/late.
const MANILA_TZ = "Asia/Manila";

function manilaDateStr(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86_400_000);
}

// Converts a Manila calendar date (YYYY-MM-DD) into the UTC instant range
// that covers that whole day, for filtering timestamptz columns.
function manilaDayBoundsUtcIso(dateStr: string) {
  const startMs = Date.parse(`${dateStr}T00:00:00.000Z`) - 8 * 60 * 60 * 1000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + 86_400_000 - 1).toISOString(),
  };
}

function formatCertLevel(level: string): string {
  if (level === "none") return "No cert on file";
  return level
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export type ActiveDiverRow = {
  id: string;
  name: string;
  certLevel: string;
  groupName: string | null;
  tripType: string;
  status: string;
  total: number;
  balance: number;
};

async function loadActiveDivers(supabase: Supabase, diveCenterId: string) {
  const { data: visits } = await supabase
    .from("visits")
    .select("id, diver_id, experience_type")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .eq("visit_status", "open")
    .order("visit_start", { ascending: false });

  const openVisits = visits ?? [];
  if (openVisits.length === 0) {
    return { activeDivers: [] as ActiveDiverRow[], pendingBillsCount: 0 };
  }

  const diverIds = [...new Set(openVisits.map((v) => v.diver_id))];
  const visitIds = openVisits.map((v) => v.id);

  const [{ data: divers }, { data: activities }, { data: payments }] =
    await Promise.all([
      supabase
        .from("divers")
        .select("id, first_name, last_name, certification_level, group_id")
        .in("id", diverIds),
      supabase
        .from("activities")
        .select("visit_id, total, status")
        .in("visit_id", visitIds),
      supabase
        .from("payments")
        .select(
          "visit_id, total_collected, total_paid, cash_amount, card_amount, online_amount, card_surcharge_amount, online_surcharge_amount",
        )
        .in("visit_id", visitIds),
    ]);

  const groupIds = [
    ...new Set((divers ?? []).map((d) => d.group_id).filter(Boolean)),
  ] as string[];
  const { data: groups } = groupIds.length
    ? await supabase.from("groups").select("id, group_name").in("id", groupIds)
    : { data: [] };
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.group_name]));
  const diverById = new Map((divers ?? []).map((d) => [d.id, d]));

  const activeDivers = openVisits
    .map((visit): ActiveDiverRow | null => {
      const diver = diverById.get(visit.diver_id);
      if (!diver) return null;

      const visitActivities = (activities ?? []).filter(
        (a) => a.visit_id === visit.id,
      );
      const total = visitActivities.reduce(
        (sum, a) => sum + safeNum(a.total),
        0,
      );
      const payment = (payments ?? []).find((p) => p.visit_id === visit.id);
      const balance = Math.max(0, total - getPaidAmount(payment));

      const status = visitActivities.some((a) => a.status === "scheduled")
        ? "Scheduled"
        : visitActivities.some((a) => a.status === "planned")
          ? "Planned"
          : visitActivities.some((a) => a.status === "ongoing")
            ? "Ongoing"
            : "On Surface";

      return {
        id: diver.id,
        name: `${diver.first_name} ${diver.last_name}`,
        certLevel: formatCertLevel(diver.certification_level),
        groupName: diver.group_id
          ? (groupNameById.get(diver.group_id) ?? null)
          : null,
        tripType:
          visit.experience_type === "dive_course" ? "Dive Course" : "Fun Diving",
        status,
        total,
        balance,
      };
    })
    .filter((d): d is ActiveDiverRow => d !== null);

  const pendingBillsCount = activeDivers.filter(
    (d) => d.total > 0 && d.balance > 0,
  ).length;

  return { activeDivers, pendingBillsCount };
}

export type BoatStatus = {
  id: string;
  name: string;
  isOut: boolean;
  detail: string;
  departureTime: string | null;
  tripLabel: string;
};

async function loadBoats(
  supabase: Supabase,
  diveCenterId: string,
  todayStr: string,
) {
  const [{ data: allBoats }, { data: schedulesToday }] = await Promise.all([
    supabase
      .from("boats")
      .select("id, name")
      .eq("dive_center_id", diveCenterId)
      .eq("is_active", true),
    supabase
      .from("schedules")
      .select("id, boat_id, departure_time, is_joiner, joiner_boat_name")
      .eq("dive_center_id", diveCenterId)
      .eq("schedule_date", todayStr)
      .eq("cancelled", false),
  ]);

  const schedules = schedulesToday ?? [];
  const scheduleIds = schedules.map((s) => s.id);

  const { data: siteRows } = scheduleIds.length
    ? await supabase
        .from("schedule_sites")
        .select("schedule_id, sort_order, dive_sites(site_name)")
        .in("schedule_id", scheduleIds)
        .order("sort_order")
    : { data: [] };

  const sitesBySchedule = new Map<string, string[]>();
  (siteRows ?? []).forEach((row) => {
    const rel = row.dive_sites as unknown;
    const site = Array.isArray(rel) ? rel[0] : rel;
    const name = (site as { site_name?: string } | null)?.site_name;
    if (!name) return;
    const list = sitesBySchedule.get(row.schedule_id) ?? [];
    list.push(name);
    sitesBySchedule.set(row.schedule_id, list);
  });

  const boatsOutCount = new Set(
    schedules.map((s) => s.boat_id).filter(Boolean),
  ).size;

  const boats: BoatStatus[] = (allBoats ?? []).map((boat) => {
    const boatSchedules = schedules
      .filter((s) => s.boat_id === boat.id)
      .sort((a, b) =>
        (a.departure_time ?? "").localeCompare(b.departure_time ?? ""),
      );
    const first = boatSchedules[0];
    const isOut = boatSchedules.length > 0;

    let detail = "Available";
    if (first) {
      const siteNames = sitesBySchedule.get(first.id);
      detail = siteNames?.length
        ? siteNames.join(", ")
        : first.is_joiner && first.joiner_boat_name
          ? `Joining ${first.joiner_boat_name}`
          : "Scheduled trip";
    }

    return {
      id: boat.id,
      name: boat.name,
      isOut,
      detail,
      departureTime: first?.departure_time ?? null,
      tripLabel: !isOut
        ? "Standby"
        : boatSchedules.length > 1
          ? `${boatSchedules.length} trips today`
          : "Out today",
    };
  });

  return { boats, boatsOutCount };
}

export type Alert = {
  type: "danger" | "warning" | "info" | "success";
  icon: string;
  title: string;
  desc: string;
  link?: string;
  linkText?: string;
};

// One alert type from the old live app has no equivalent yet in this
// schema and is deliberately not reproduced here — see KNOWN_GAPS.md:
// "another boat joined us today" (no signal captured at schedule-creation
// time for that direction). Depends on data entry that belongs to the
// Scheduling page, not built yet.
//
// "Government fees not logged" was skipped for the same reason until the
// Reports build (see database/006_govt_fees_daily_log.sql) — govt_fees is
// now the real daily log the live app always expected, so this alert is
// restored.
async function loadAlerts(
  supabase: Supabase,
  diveCenterId: string,
  todayStr: string,
  tomorrowStr: string,
) {
  const alerts: Alert[] = [];

  const { data: dc } = await supabase
    .from("dive_centers")
    .select(
      "fuel_gasoline_level, fuel_gasoline_threshold, fuel_diesel_level, fuel_diesel_threshold",
    )
    .eq("id", diveCenterId)
    .single();

  if (dc) {
    if (
      dc.fuel_gasoline_threshold != null &&
      dc.fuel_gasoline_level != null &&
      dc.fuel_gasoline_level <= dc.fuel_gasoline_threshold
    ) {
      alerts.push({
        type: "danger",
        icon: "⛽",
        title: "Low Gasoline",
        desc: `Current level: ${dc.fuel_gasoline_level} L — at or below threshold of ${dc.fuel_gasoline_threshold} L`,
      });
    }
    if (
      dc.fuel_diesel_threshold != null &&
      dc.fuel_diesel_level != null &&
      dc.fuel_diesel_level <= dc.fuel_diesel_threshold
    ) {
      alerts.push({
        type: "danger",
        icon: "⛽",
        title: "Low Diesel",
        desc: `Current level: ${dc.fuel_diesel_level} L — at or below threshold of ${dc.fuel_diesel_threshold} L`,
      });
    }
  }

  const { data: tanks } = await supabase
    .from("tanks")
    .select("type, available_count, low_alert_threshold")
    .eq("dive_center_id", diveCenterId);

  (tanks ?? []).forEach((tank) => {
    if (tank.available_count <= tank.low_alert_threshold) {
      alerts.push({
        type: "danger",
        icon: "⚠️",
        title: `Low ${tank.type} tanks`,
        desc: `Only ${tank.available_count} tanks remaining — below threshold of ${tank.low_alert_threshold}`,
      });
    }
  });

  const { data: unpaidVisits } = await supabase
    .from("visits")
    .select("id")
    .eq("dive_center_id", diveCenterId)
    .eq("is_paid", false);
  const unpaidIds = (unpaidVisits ?? []).map((v) => v.id);

  if (unpaidIds.length > 0) {
    const { data: acts } = await supabase
      .from("activities")
      .select("visit_id, date")
      .in("visit_id", unpaidIds);

    const lastActivityByVisit = new Map<string, string>();
    (acts ?? []).forEach((a) => {
      const cur = lastActivityByVisit.get(a.visit_id);
      if (!cur || a.date > cur) lastActivityByVisit.set(a.visit_id, a.date);
    });

    const threeDaysAgoStr = manilaDateStr(addDays(new Date(), -3));
    const overdueCount = [...lastActivityByVisit.values()].filter(
      (d) => d < threeDaysAgoStr,
    ).length;

    if (overdueCount > 0) {
      alerts.push({
        type: "warning",
        icon: "💰",
        title: `${overdueCount} overdue bill${overdueCount > 1 ? "s" : ""}`,
        desc: "Divers with unsettled bills for 3 or more days",
      });
    }
  }

  const { data: completedToday } = await supabase
    .from("activities")
    .select("id")
    .eq("dive_center_id", diveCenterId)
    .eq("status", "completed")
    .eq("date", todayStr)
    .limit(1);

  if ((completedToday ?? []).length > 0) {
    const { data: govtFeesToday } = await supabase
      .from("govt_fees")
      .select("id")
      .eq("dive_center_id", diveCenterId)
      .eq("date", todayStr)
      .limit(1);

    if (!govtFeesToday || govtFeesToday.length === 0) {
      alerts.push({
        type: "info",
        icon: "🤿",
        title: "Great dives today!",
        desc: "Just a heads up — government fees for today aren't logged yet.",
        link: "/reports?tab=govtfees",
        linkText: "Log them here →",
      });
    }
  }

  const { data: joinedBoatSchedules } = await supabase
    .from("schedules")
    .select("id")
    .eq("dive_center_id", diveCenterId)
    .eq("schedule_date", todayStr)
    .eq("is_joiner", true)
    .eq("cancelled", false)
    .limit(1);

  if ((joinedBoatSchedules ?? []).length > 0) {
    const { data: logged } = await supabase
      .from("join_ride_records")
      .select("id")
      .eq("dive_center_id", diveCenterId)
      .eq("date", todayStr)
      .eq("direction", "we_joined_another_boat")
      .limit(1);

    if (!logged || logged.length === 0) {
      alerts.push({
        type: "info",
        icon: "🚤",
        title: "Looks like your crew hitched a ride today!",
        desc: "Pop it into Reports when you get a chance.",
        link: "/reports?tab=join",
        linkText: "Go to Join Ride →",
      });
    }
  }

  const { data: arriving } = await supabase
    .from("diver_registrations")
    .select("diver_id, needs_equipment, equipment_requested")
    .eq("dive_center_id", diveCenterId)
    .eq("arrival_date", tomorrowStr);

  const arrivingList = arriving ?? [];
  if (arrivingList.length > 0) {
    alerts.push({
      type: "info",
      icon: "🤿",
      title: `${arrivingList.length} diver${arrivingList.length > 1 ? "s" : ""} arriving tomorrow.`,
      desc: `Arriving ${new Date(`${tomorrowStr}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`,
      link: `/divers?mode=equipment&date=${tomorrowStr}`,
      linkText: "View Equipment Management →",
    });

    const requestedCounts = new Map<string, number>();
    arrivingList.forEach((d) => {
      if (!d.needs_equipment || !d.equipment_requested) return;
      try {
        const eq = JSON.parse(d.equipment_requested) as {
          type?: string;
          items?: Record<string, unknown>;
        };
        if (eq.type === "partial" && eq.items) {
          Object.entries(eq.items).forEach(([item, val]) => {
            if (!val || item === "computer" || item === "weights_kg") return;
            const key = item.toLowerCase();
            requestedCounts.set(key, (requestedCounts.get(key) ?? 0) + 1);
          });
          if (eq.items.computer) {
            requestedCounts.set(
              "dive computer",
              (requestedCounts.get("dive computer") ?? 0) + 1,
            );
          }
        }
      } catch {
        // Malformed equipment_requested payload — skip this diver's request.
      }
    });

    const { data: stock } = await supabase
      .from("equipment")
      .select("name, total_count")
      .eq("dive_center_id", diveCenterId);

    let shortCount = 0;
    (stock ?? []).forEach((item) => {
      const requested = requestedCounts.get((item.name ?? "").toLowerCase()) ?? 0;
      if (item.total_count != null && requested >= item.total_count) {
        shortCount++;
      }
    });

    if (shortCount > 0) {
      alerts.push({
        type: "warning",
        icon: "🎽",
        title: `${shortCount} equipment item${shortCount > 1 ? "s" : ""} may run short for tomorrow's arrivals.`,
        desc: "Requested quantity meets or exceeds tracked stock for tomorrow.",
        link: `/divers?mode=equipment&date=${tomorrowStr}`,
        linkText: "View Equipment Management →",
      });
    }
  }

  if (alerts.length === 0) {
    alerts.push({
      type: "success",
      icon: "✅",
      title: "All clear",
      desc: "No alerts at this time",
    });
  }

  return {
    alerts,
    hasCriticalAlert: alerts.some((a) => a.type === "danger"),
  };
}

export type PaymentChannels = {
  cash: number;
  card: number;
  online: number;
  total: number;
};

async function loadPaymentChannels(
  supabase: Supabase,
  diveCenterId: string,
  todayStr: string,
): Promise<PaymentChannels> {
  const { startIso, endIso } = manilaDayBoundsUtcIso(todayStr);

  const [{ data: payments }, { data: deposits }] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "cash_amount, cash_amount_foreign, cash_exchange_rate, card_amount, card_surcharge_amount, online_amount, online_surcharge_amount",
      )
      .eq("dive_center_id", diveCenterId)
      .gte("paid_at", startIso)
      .lte("paid_at", endIso),
    supabase
      .from("deposits")
      .select("amount, method")
      .eq("dive_center_id", diveCenterId)
      .eq("deposit_date", todayStr),
  ]);

  const rows = payments ?? [];
  const cash = rows.reduce(
    (s, p) =>
      s + safeNum(p.cash_amount) + safeNum(p.cash_amount_foreign) * safeNum(p.cash_exchange_rate),
    0,
  );
  const card = rows.reduce(
    (s, p) => s + safeNum(p.card_amount) + safeNum(p.card_surcharge_amount),
    0,
  );
  const online = rows.reduce(
    (s, p) => s + safeNum(p.online_amount) + safeNum(p.online_surcharge_amount),
    0,
  );

  const deps = deposits ?? [];
  const depSum = (method: string) =>
    deps
      .filter((d) => d.method === method)
      .reduce((s, d) => s + safeNum(d.amount), 0);

  const totalCash = cash + depSum("cash");
  const totalCard = card + depSum("card");
  const totalOnline = online + depSum("online");

  return {
    cash: totalCash,
    card: totalCard,
    online: totalOnline,
    total: totalCash + totalCard + totalOnline,
  };
}

export type RevenueChartDay = {
  label: string;
  amount: number;
  isToday: boolean;
};

export type Revenue = {
  today: number;
  week: number;
  month: number;
  chart: RevenueChartDay[];
};

async function loadRevenue(
  supabase: Supabase,
  diveCenterId: string,
): Promise<Revenue> {
  const now = new Date();
  const todayStr = manilaDateStr(now);
  const sevenDaysAgo = addDays(now, -6);
  const sevenDaysAgoStr = manilaDateStr(sevenDaysAgo);
  const monthStartStr = `${todayStr.slice(0, 7)}-01`;
  const queryFromStr = sevenDaysAgoStr < monthStartStr ? sevenDaysAgoStr : monthStartStr;
  const { startIso: queryFromIso } = manilaDayBoundsUtcIso(queryFromStr);

  const { data: payments } = await supabase
    .from("payments")
    .select("paid_at, grand_total_php")
    .eq("dive_center_id", diveCenterId)
    .eq("is_paid", true)
    .gte("paid_at", queryFromIso);

  const rows = (payments ?? []).filter(
    (p): p is { paid_at: string; grand_total_php: number } => !!p.paid_at,
  );
  const dayOf = (iso: string) => manilaDateStr(new Date(iso));
  const sumFor = (dateStr: string) =>
    rows
      .filter((p) => dayOf(p.paid_at) === dateStr)
      .reduce((s, p) => s + safeNum(p.grand_total_php), 0);

  const today = sumFor(todayStr);
  const week = rows
    .filter((p) => dayOf(p.paid_at) >= sevenDaysAgoStr)
    .reduce((s, p) => s + safeNum(p.grand_total_php), 0);
  const month = rows
    .filter((p) => dayOf(p.paid_at) >= monthStartStr)
    .reduce((s, p) => s + safeNum(p.grand_total_php), 0);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const chart: RevenueChartDay[] = Array.from({ length: 7 }, (_, i) => {
    const dateStr = manilaDateStr(addDays(sevenDaysAgo, i));
    return {
      label: dayNames[new Date(`${dateStr}T00:00:00Z`).getUTCDay()],
      amount: sumFor(dateStr),
      isToday: dateStr === todayStr,
    };
  });

  return { today, week, month, chart };
}

export type DashboardData = {
  todayStr: string;
  activeDivers: ActiveDiverRow[];
  pendingBillsCount: number;
  boats: BoatStatus[];
  boatsOutCount: number;
  alerts: Alert[];
  hasCriticalAlert: boolean;
  paymentChannels: PaymentChannels;
  revenue: Revenue | null;
};

export async function loadDashboardData(
  diveCenterId: string,
  canViewRevenue: boolean,
): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const todayStr = manilaDateStr(now);
  const tomorrowStr = manilaDateStr(addDays(now, 1));

  const [
    { activeDivers, pendingBillsCount },
    { boats, boatsOutCount },
    { alerts, hasCriticalAlert },
    paymentChannels,
    revenue,
  ] = await Promise.all([
    loadActiveDivers(supabase, diveCenterId),
    loadBoats(supabase, diveCenterId, todayStr),
    loadAlerts(supabase, diveCenterId, todayStr, tomorrowStr),
    loadPaymentChannels(supabase, diveCenterId, todayStr),
    canViewRevenue ? loadRevenue(supabase, diveCenterId) : Promise.resolve(null),
  ]);

  return {
    todayStr,
    activeDivers,
    pendingBillsCount,
    boats,
    boatsOutCount,
    alerts,
    hasCriticalAlert,
    paymentChannels,
    revenue,
  };
}
