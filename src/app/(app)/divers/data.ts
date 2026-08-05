import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPaidAmount } from "@/lib/payments";
import { isDiverActive, isGroupActive } from "./visibility";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Duplicated from diver-form/[id]/components/FlagsBanner.tsx's own copy
// (that one's a client component, this one's server-only, matching this
// codebase's established small-helper-duplication precedent rather than
// sharing across that boundary). Date.UTC here is only ever used to
// produce a millisecond difference for comparison, never read back out as
// a rolled-over Y-M-D value.
function isDiveStale(lastDiveDate: string | null): boolean {
  if (!lastDiveDate) return false;
  const [ly, lm, ld] = lastDiveDate.split("-").map(Number);
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const daysSince = (Date.UTC(ty, tm - 1, td) - Date.UTC(ly, lm - 1, ld)) / 86400000;
  return daysSince > 182;
}

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
  lastDiveDate: string | null;
  staleDive: boolean;
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
      .select("id, first_name, last_name, certification_level, group_id, is_minor, medical_acknowledged, last_dive_date")
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

  // Every non-voided visit per diver (not just the latest) — needed to
  // correctly determine "bill fully closed" across a diver's entire visit
  // history, matching the live app's billIsFullyClosed()/hasClosedBillRecord()
  // exactly rather than only inspecting the single most recent visit (which
  // could miss an older closed/paid visit sitting behind a newer one).
  const nonVoidedVisitsByDiver = new Map<string, { isActive: boolean; isPaid: boolean; status: string }[]>();
  (visits ?? []).forEach((v) => {
    if (v.visit_status === "voided") return;
    const list = nonVoidedVisitsByDiver.get(v.diver_id) ?? [];
    list.push({ isActive: v.is_active, isPaid: v.is_paid, status: v.visit_status });
    nonVoidedVisitsByDiver.set(v.diver_id, list);
  });

  // Activities/payments fetched by diver_id (not visit_id) — the bill stack
  // still only shows the latest visit's rows (unchanged), but the fully-
  // closed check needs every payment/activity across the diver's whole
  // history for its own total-paid-covers-total-billed fallback.
  const [{ data: activities }, { data: payments }] = await Promise.all([
    supabase.from("activities").select("diver_id, visit_id, date, total, status").in("diver_id", diverIds),
    supabase
      .from("payments")
      .select(
        "diver_id, visit_id, total_collected, total_paid, cash_amount, card_amount, online_amount, card_surcharge_amount, online_surcharge_amount, grand_total_php, discount, paid_at, is_paid",
      )
      .in("diver_id", diverIds),
  ]);

  const activitiesByVisit = new Map<string, { date: string; total: number; status: string }[]>();
  const activitiesTotalByDiver = new Map<string, number>();
  (activities ?? []).forEach((a) => {
    const visitList = activitiesByVisit.get(a.visit_id) ?? [];
    visitList.push({ date: a.date, total: Number(a.total) || 0, status: a.status });
    activitiesByVisit.set(a.visit_id, visitList);
    if (a.status !== "cancelled") {
      activitiesTotalByDiver.set(a.diver_id, (activitiesTotalByDiver.get(a.diver_id) ?? 0) + (Number(a.total) || 0));
    }
  });

  const paymentByVisit = new Map((payments ?? []).map((p) => [p.visit_id, p]));
  const paymentsByDiver = new Map<string, { isPaid: boolean }[]>();
  const paidTotalByDiver = new Map<string, number>();
  (payments ?? []).forEach((p) => {
    const list = paymentsByDiver.get(p.diver_id) ?? [];
    list.push({ isPaid: !!p.is_paid });
    paymentsByDiver.set(p.diver_id, list);
    paidTotalByDiver.set(p.diver_id, (paidTotalByDiver.get(p.diver_id) ?? 0) + getPaidAmount(p));
  });

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

    // Mirrors the live app's billIsFullyClosed()/hasClosedBillRecord(): no
    // currently-open visit, AND (any non-voided visit already flagged
    // paid/inactive/closed, OR any payment row flagged is_paid, OR the
    // diver's total paid across all visits already covers their total
    // billed activity) — checked across the diver's ENTIRE visit/payment
    // history, not just their single most recent visit.
    const diverVisits = nonVoidedVisitsByDiver.get(d.id) ?? [];
    const hasOpenVisit = diverVisits.some((v) => v.isActive && v.status !== "closed" && !v.isPaid);
    const activitiesTotal = activitiesTotalByDiver.get(d.id) ?? 0;
    const paidTotal = paidTotalByDiver.get(d.id) ?? 0;
    const hasClosedRecord =
      diverVisits.some((v) => v.isPaid || !v.isActive || v.status === "closed") ||
      (paymentsByDiver.get(d.id) ?? []).some((p) => p.isPaid) ||
      (activitiesTotal > 0 && paidTotal >= activitiesTotal);
    const billFullyClosed = !hasOpenVisit && hasClosedRecord;

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
      lastDiveDate: d.last_dive_date,
      staleDive: isDiveStale(d.last_dive_date),
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

// A card whose bill is already fully closed but hasn't departed yet has
// nothing left needing attention — sorts after everyone still active, so
// secretaries scanning the top of the list see only guests still actually
// diving/billing, not paid-up guests just waiting out their stay. Applied
// only to the already-filtered active set above, so this alone is a
// sufficient predicate: a visible card with billFullyClosed=true here is
// provably not yet departed (a departed + fully-closed card was already
// excluded by isDiverActive/isGroupActive).
function sortDoneLast<T extends { billFullyClosed: boolean }>(cards: T[]): T[] {
  return [...cards].sort((a, b) => Number(a.billFullyClosed) - Number(b.billFullyClosed));
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
  return sortDoneLast(filterActiveIndividualCards(cards)).slice(0, 20);
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
  return sortDoneLast(filterActiveIndividualCards(cards));
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
// groupIsVisible() exactly: a group with members is active iff at least one
// member is still active-in-group (isDiverActiveInGroup — no arrival gate,
// unlike individual isDiverActive); an empty group is always active (visible
// from creation, since a secretary needs to reach it well before arrival to
// share the registration link). Groups where every member is fully billed
// but at least one hasn't departed yet ("nothing left to do") sort last,
// same reasoning as sortDoneLast above.
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

  // Visibility/sort both hinge on each member's departure date + bill-closed
  // status — reuse buildDiverCards (already computes both correctly) rather
  // than re-deriving the same visit/payment logic a third time, batched
  // across every group's members in one pass.
  const allMemberIds = [...memberIdsByGroup.values()].flat();
  const memberCards = await buildDiverCards(supabase, diveCenterId, allMemberIds);
  const cardsByGroup = new Map<string, DiverCard[]>();
  memberCards.forEach((c) => {
    if (!c.groupId) return;
    const list = cardsByGroup.get(c.groupId) ?? [];
    list.push(c);
    cardsByGroup.set(c.groupId, list);
  });

  const withVisibility = (groups ?? []).map((g) => {
    const members = cardsByGroup.get(g.id) ?? [];
    return {
      summary: {
        id: g.id,
        groupName: g.group_name,
        leaderName: g.leader_name,
        arrivalDate: g.arrival_date,
        departureDate: g.departure_date,
        expectedCount: g.expected_count,
        memberCount: members.length,
      },
      active: isGroupActive(members.map((m) => ({ departureDate: m.departureDate, billFullyClosed: m.billFullyClosed }))),
      allBilledNotDeparted: members.length > 0 && members.every((m) => m.billFullyClosed),
    };
  });

  return withVisibility
    .filter((g) => g.active)
    .sort((a, b) => Number(a.allBilledNotDeparted) - Number(b.allBilledNotDeparted))
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
  needsEquipment: boolean;
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
    .select("id, first_name, last_name, group_id, needs_equipment, equipment_requested, equipment_notes")
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
    needsEquipment: !!d.needs_equipment,
    equipmentRequested: d.equipment_requested,
    equipmentNotes: d.equipment_notes,
  }));
}

export async function loadGearInventoryCounts(diveCenterId: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipment")
    .select("name, total_count")
    .eq("dive_center_id", diveCenterId)
    .eq("is_active", true);
  return Object.fromEntries((data ?? []).map((r) => [r.name, r.total_count as number]));
}
