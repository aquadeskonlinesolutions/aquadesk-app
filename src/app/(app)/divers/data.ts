import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPaidAmount } from "@/lib/payments";
import { isDiverActive, isGroupActive } from "./visibility";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type DiverCard = {
  id: string;
  firstName: string;
  lastName: string;
  certificationLevel: string;
  groupId: string | null;
  groupName: string | null;
  isMinor: boolean;
  medicalFlag: boolean;
  medicalAcknowledged: boolean;
  arrivalDate: string | null;
  departureDate: string | null;
  alreadyInScheduling: boolean;
  billClosed: boolean;
  billFullyClosed: boolean;
  billClosedAt: string | null;
  // Group-member view (showBilling=true equivalent): a per-day breakdown.
  dayBreakdown: { date: string; total: number }[];
  totalDives: number;
  totalBill: number;
  // Individual view equivalent: a single running total + balance.
  runningBill: number;
  balance: number;
};

// Shared by both Group Management (member drill-down) and Individual
// Management (search results / recent list) — the live app's divers.html
// renders the same diverMiniCard shape in both places, just with a
// different bill-stack variant (day breakdown vs. running bill/balance),
// both computed here so either tab can pick what it needs.
async function buildDiverCards(supabase: Supabase, diveCenterId: string, diverIds: string[]): Promise<DiverCard[]> {
  if (diverIds.length === 0) return [];

  const [{ data: divers }, { data: registrations }, { data: visits }] = await Promise.all([
    supabase
      .from("divers")
      .select("id, first_name, last_name, certification_level, group_id, is_minor, medical_acknowledged")
      .in("id", diverIds),
    supabase
      .from("diver_registrations")
      .select("diver_id, arrival_date, departure_date, medical_flag, created_at")
      .in("diver_id", diverIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("visits")
      .select("id, diver_id, is_active, is_paid, visit_status, created_at")
      .in("diver_id", diverIds)
      .order("created_at", { ascending: false }),
  ]);

  const groupIds = [...new Set((divers ?? []).map((d) => d.group_id).filter(Boolean))] as string[];
  const { data: groups } = groupIds.length
    ? await supabase.from("groups").select("id, group_name").in("id", groupIds)
    : { data: [] };
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.group_name]));

  // Most recent registration per diver (for arrival/departure date + medical flag).
  const latestRegByDiver = new Map<
    string,
    { arrival_date: string | null; departure_date: string | null; medical_flag: boolean }
  >();
  (registrations ?? []).forEach((r) => {
    if (!latestRegByDiver.has(r.diver_id)) {
      latestRegByDiver.set(r.diver_id, {
        arrival_date: r.arrival_date,
        departure_date: r.departure_date,
        medical_flag: !!r.medical_flag,
      });
    }
  });

  // Most recent visit per diver (open or otherwise) — used both to detect
  // "already in scheduling" and to pull activities/payment for the bill stack.
  const latestVisitByDiver = new Map<string, { id: string; isActive: boolean; isPaid: boolean; status: string }>();
  (visits ?? []).forEach((v) => {
    if (!latestVisitByDiver.has(v.diver_id)) {
      latestVisitByDiver.set(v.diver_id, { id: v.id, isActive: v.is_active, isPaid: v.is_paid, status: v.visit_status });
    }
  });

  const visitIds = [...latestVisitByDiver.values()].map((v) => v.id);
  const [{ data: activities }, { data: payments }] = await Promise.all([
    visitIds.length
      ? supabase.from("activities").select("visit_id, date, total, status").in("visit_id", visitIds)
      : Promise.resolve({ data: [] }),
    visitIds.length
      ? supabase
          .from("payments")
          .select(
            "visit_id, total_collected, total_paid, cash_amount, card_amount, online_amount, card_surcharge_amount, online_surcharge_amount, grand_total_php, discount, paid_at",
          )
          .in("visit_id", visitIds)
      : Promise.resolve({ data: [] }),
  ]);

  const activitiesByVisit = new Map<string, { date: string; total: number; status: string }[]>();
  (activities ?? []).forEach((a) => {
    const list = activitiesByVisit.get(a.visit_id) ?? [];
    list.push({ date: a.date, total: Number(a.total) || 0, status: a.status });
    activitiesByVisit.set(a.visit_id, list);
  });
  const paymentByVisit = new Map((payments ?? []).map((p) => [p.visit_id, p]));

  return (divers ?? []).map((d) => {
    const reg = latestRegByDiver.get(d.id);
    const visit = latestVisitByDiver.get(d.id);
    const visitActivities = (visit ? activitiesByVisit.get(visit.id) : []) ?? [];
    const nonCancelled = visitActivities.filter((a) => a.status !== "cancelled");
    const payment = visit ? paymentByVisit.get(visit.id) : undefined;

    // Day-by-day breakdown, most recent 3 days, matching the live app's cap.
    const byDate = new Map<string, number>();
    nonCancelled.forEach((a) => byDate.set(a.date, (byDate.get(a.date) ?? 0) + a.total));
    const dayBreakdown = [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 3)
      .map(([date, total]) => ({ date, total }));

    const totalBill = nonCancelled.reduce((s, a) => s + a.total, 0);
    const paid = getPaidAmount(payment);
    const grandTotal = payment ? Number(payment.grand_total_php) || 0 : totalBill;
    const discount = payment ? Number(payment.discount) || 0 : 0;

    const alreadyInScheduling = !!visit && visit.isActive && visit.status === "open" && !visit.isPaid;
    const billClosed = !!visit && visit.status === "closed";
    // Mirrors the live app's billIsFullyClosed(): no open visit AND some
    // closed/paid record exists. A diver with no visit at all (never
    // actually processed) is NOT fully closed — matches divers.html's
    // isVisible(), which keeps such a diver visible indefinitely.
    const billFullyClosed = !alreadyInScheduling && billClosed;

    return {
      id: d.id,
      firstName: d.first_name,
      lastName: d.last_name,
      certificationLevel: d.certification_level,
      groupId: d.group_id,
      groupName: d.group_id ? (groupNameById.get(d.group_id) ?? null) : null,
      isMinor: !!d.is_minor,
      medicalFlag: !!reg?.medical_flag,
      medicalAcknowledged: !!d.medical_acknowledged,
      arrivalDate: reg?.arrival_date ?? null,
      departureDate: reg?.departure_date ?? null,
      alreadyInScheduling,
      billClosed,
      billFullyClosed,
      billClosedAt: billClosed ? (payment?.paid_at ?? null) : null,
      dayBreakdown,
      totalDives: nonCancelled.length,
      totalBill,
      runningBill: totalBill,
      balance: Math.max(0, grandTotal - discount - paid),
    };
  });
}

// Matches divers.html's isIndividualCandidate: ungrouped AND currently
// active (isVisible). Both the default/recent list and explicit search
// scope to this — the live app's candidate filter doesn't distinguish
// "browsing" from "searching," it's the same Individual Management pool.
function filterActiveIndividualCards(cards: DiverCard[]): DiverCard[] {
  return cards.filter(
    (c) =>
      !c.groupId &&
      isDiverActive({
        arrivalDate: c.arrivalDate,
        departureDate: c.departureDate,
        hasOpenVisit: c.alreadyInScheduling,
        billFullyClosed: c.billFullyClosed,
      }),
  );
}

export async function loadRecentDiverCards(diveCenterId: string): Promise<DiverCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("divers")
    .select("id")
    .eq("dive_center_id", diveCenterId)
    .is("group_id", null)
    .order("created_at", { ascending: false })
    .limit(50);
  const cards = await buildDiverCards(supabase, diveCenterId, (data ?? []).map((d) => d.id));
  return filterActiveIndividualCards(cards).slice(0, 20);
}

export async function searchDiverCards(diveCenterId: string, query: string): Promise<DiverCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("divers")
    .select("id")
    .eq("dive_center_id", diveCenterId)
    .is("group_id", null)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,accommodation.ilike.%${query}%`)
    .limit(30);
  const cards = await buildDiverCards(supabase, diveCenterId, (data ?? []).map((d) => d.id));
  return filterActiveIndividualCards(cards);
}

export type GroupSummary = {
  id: string;
  groupName: string;
  leaderName: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  expectedCount: number | null;
  memberCount: number;
};

// Only currently-active groups show up here, matching divers.html's
// groupIsVisible(): a group with members is active iff any member is
// active (isDiverActive); an empty group is active iff today falls within
// arrival-1..departure (or has no arrival date at all).
export async function loadGroups(diveCenterId: string): Promise<GroupSummary[]> {
  const supabase = await createClient();
  const [{ data: groups }, { data: memberRows }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, group_name, leader_name, arrival_date, departure_date, expected_count")
      .eq("dive_center_id", diveCenterId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase.from("divers").select("id, group_id").eq("dive_center_id", diveCenterId).not("group_id", "is", null),
  ]);

  const memberIdsByGroup = new Map<string, string[]>();
  (memberRows ?? []).forEach((m) => {
    if (!m.group_id) return;
    const list = memberIdsByGroup.get(m.group_id) ?? [];
    list.push(m.id);
    memberIdsByGroup.set(m.group_id, list);
  });

  const allMemberIds = (memberRows ?? []).map((m) => m.id);
  const memberCards = await buildDiverCards(supabase, diveCenterId, allMemberIds);
  const memberCardById = new Map(memberCards.map((c) => [c.id, c]));

  return (groups ?? [])
    .map((g) => {
      const memberIds = memberIdsByGroup.get(g.id) ?? [];
      const members = memberIds.flatMap((id) => {
        const c = memberCardById.get(id);
        return c
          ? [
              {
                arrivalDate: c.arrivalDate,
                departureDate: c.departureDate,
                hasOpenVisit: c.alreadyInScheduling,
                billFullyClosed: c.billFullyClosed,
              },
            ]
          : [];
      });
      const active = isGroupActive(
        { arrivalDate: g.arrival_date, departureDate: g.departure_date },
        members,
      );
      return {
        active,
        summary: {
          id: g.id,
          groupName: g.group_name,
          leaderName: g.leader_name,
          arrivalDate: g.arrival_date,
          departureDate: g.departure_date,
          expectedCount: g.expected_count,
          memberCount: memberIds.length,
        } satisfies GroupSummary,
      };
    })
    .filter((g) => g.active)
    .map((g) => g.summary);
}

export async function loadGroupMemberCards(diveCenterId: string, groupId: string): Promise<DiverCard[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("divers").select("id").eq("dive_center_id", diveCenterId).eq("group_id", groupId);
  return buildDiverCards(supabase, diveCenterId, (data ?? []).map((d) => d.id));
}

export type GroupDeletionBlocker = { diverName: string; reasons: string[] };

export async function checkGroupDeletionBlockers(diveCenterId: string, groupId: string): Promise<GroupDeletionBlocker[]> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("divers")
    .select("id, first_name, last_name")
    .eq("dive_center_id", diveCenterId)
    .eq("group_id", groupId);
  if (!members || members.length === 0) return [];

  const memberIds = members.map((m) => m.id);
  const [{ data: scheduleDivers }, { data: openVisits }, { data: activities }] = await Promise.all([
    supabase.from("schedule_divers").select("diver_id").eq("dive_center_id", diveCenterId).in("diver_id", memberIds),
    supabase
      .from("visits")
      .select("diver_id")
      .eq("dive_center_id", diveCenterId)
      .in("diver_id", memberIds)
      .eq("is_active", true)
      .eq("is_paid", false),
    supabase.from("activities").select("diver_id").eq("dive_center_id", diveCenterId).in("diver_id", memberIds),
  ]);

  const scheduledIds = new Set((scheduleDivers ?? []).map((r) => r.diver_id));
  const openVisitIds = new Set((openVisits ?? []).map((r) => r.diver_id));
  const activityIds = new Set((activities ?? []).map((r) => r.diver_id));

  const blockers: GroupDeletionBlocker[] = [];
  members.forEach((m) => {
    const reasons: string[] = [];
    if (scheduledIds.has(m.id)) reasons.push("assigned to a trip");
    if (openVisitIds.has(m.id)) reasons.push("open unpaid visit");
    if (activityIds.has(m.id)) reasons.push("has billing activity");
    if (reasons.length > 0) blockers.push({ diverName: `${m.first_name} ${m.last_name}`, reasons });
  });
  return blockers;
}

export type CourseRateOption = { id: string; courseName: string; rate: number };

export async function loadCourseRateOptions(diveCenterId: string): Promise<CourseRateOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_rates")
    .select("id, course_name, rate")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true)
    .order("course_name");
  return (data ?? []).map((c) => ({ id: c.id, courseName: c.course_name, rate: Number(c.rate) }));
}

export type EquipmentPrepDiver = {
  id: string;
  firstName: string;
  lastName: string;
  groupName: string | null;
  equipmentRequested: string | null;
  equipmentNotes: string | null;
};

export async function loadEquipmentPrepDivers(diveCenterId: string, date: string): Promise<EquipmentPrepDiver[]> {
  const supabase = await createClient();
  const { data: registrations } = await supabase
    .from("diver_registrations")
    .select("diver_id, arrival_date, created_at")
    .eq("dive_center_id", diveCenterId)
    .eq("arrival_date", date)
    .order("created_at", { ascending: false });

  const diverIds = [...new Set((registrations ?? []).map((r) => r.diver_id))];
  if (diverIds.length === 0) return [];

  const { data: divers } = await supabase
    .from("divers")
    .select("id, first_name, last_name, group_id, equipment_requested, equipment_notes")
    .in("id", diverIds);

  const groupIds = [...new Set((divers ?? []).map((d) => d.group_id).filter(Boolean))] as string[];
  const { data: groups } = groupIds.length
    ? await supabase.from("groups").select("id, group_name").in("id", groupIds)
    : { data: [] };
  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.group_name]));

  return (divers ?? []).map((d) => ({
    id: d.id,
    firstName: d.first_name,
    lastName: d.last_name,
    groupName: d.group_id ? (groupNameById.get(d.group_id) ?? null) : null,
    equipmentRequested: d.equipment_requested,
    equipmentNotes: d.equipment_notes,
  }));
}
