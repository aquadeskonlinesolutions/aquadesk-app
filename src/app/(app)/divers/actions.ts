"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  loadRecentDiverCards,
  searchDiverCards,
  loadGroups,
  loadGroupMemberCards,
  checkGroupDeletionBlockers,
  loadEquipmentPrepDivers,
  type DiverCard,
  type GroupSummary,
  type GroupDeletionBlocker,
  type EquipmentPrepDiver,
} from "./data";

function ok() {
  revalidatePath("/divers");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

// ── Reads (thin wrappers so client components never import server-only data.ts) ──

export async function getRecentDiverCards(): Promise<DiverCard[]> {
  const user = await getCurrentUser();
  return loadRecentDiverCards(user.diveCenterId);
}

export async function searchDivers(query: string): Promise<DiverCard[]> {
  const user = await getCurrentUser();
  if (query.trim().length < 2) return [];
  return searchDiverCards(user.diveCenterId, query.trim());
}

export async function getGroups(): Promise<GroupSummary[]> {
  const user = await getCurrentUser();
  return loadGroups(user.diveCenterId);
}

export async function getGroupMembers(groupId: string): Promise<DiverCard[]> {
  const user = await getCurrentUser();
  return loadGroupMemberCards(user.diveCenterId, groupId);
}

export async function getGroupDeletionBlockers(groupId: string): Promise<GroupDeletionBlocker[]> {
  const user = await getCurrentUser();
  return checkGroupDeletionBlockers(user.diveCenterId, groupId);
}

export async function getEquipmentPrepDivers(date: string): Promise<EquipmentPrepDiver[]> {
  const user = await getCurrentUser();
  return loadEquipmentPrepDivers(user.diveCenterId, date);
}

// ── Groups — moved here from Scheduling (this page is the live app's real
// home for group management, not Scheduling) ──

export async function createRegistrationLinkGroup(input: {
  groupName: string;
  leaderName: string;
  arrivalDate: string;
  departureDate: string;
  expectedCount: string;
  notes: string;
}): Promise<{ error?: string; groupId?: string; registrationLink?: string }> {
  const user = await getCurrentUser();
  if (!input.groupName.trim()) return fail("Group name is required.");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groups")
    .insert({
      dive_center_id: user.diveCenterId,
      group_name: input.groupName.trim(),
      leader_name: input.leaderName.trim() || null,
      arrival_date: input.arrivalDate || null,
      departure_date: input.departureDate || null,
      expected_count: input.expectedCount.trim() ? Number(input.expectedCount) : null,
      notes: input.notes.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return fail(error.message);
  revalidatePath("/divers");
  return {
    groupId: data.id,
    registrationLink: `/register?dc=${user.diveCenterId}&group=${data.id}`,
  };
}

export async function createAdHocGroup(
  groupName: string,
  diverIds: string[],
): Promise<{ error?: string; groupId?: string }> {
  const user = await getCurrentUser();
  if (!groupName.trim()) return fail("Group name is required.");
  if (diverIds.length < 2) return fail("Select at least 2 divers.");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groups")
    .insert({ dive_center_id: user.diveCenterId, group_name: groupName.trim(), is_active: true })
    .select("id")
    .single();
  if (error) return fail(error.message);

  const { error: updateError } = await supabase
    .from("divers")
    .update({ group_id: data.id })
    .in("id", diverIds)
    .eq("dive_center_id", user.diveCenterId);
  if (updateError) return fail(updateError.message);

  revalidatePath("/divers");
  return { groupId: data.id };
}

export async function deleteGroup(groupId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const blockers = await checkGroupDeletionBlockers(user.diveCenterId, groupId);
  if (blockers.length > 0) {
    return fail(`Can't delete — ${blockers.map((b) => `${b.diverName} (${b.reasons.join(", ")})`).join("; ")}.`);
  }

  const { error } = await supabase.from("groups").delete().eq("id", groupId).eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── Diver-card actions ──

// Matches the live app's own confirmation copy exactly (removeFromGroup,
// divers.html) — this deletes the diver record itself, not just a group
// membership.
export async function removeDiver(diverId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("divers").delete().eq("id", diverId).eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// Standardized on the at/by pair, not the plain `medical_acknowledged`
// boolean also present on this table — same pattern as diver-form/[id]/actions.ts.
export async function acknowledgeMedical(diverId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("divers")
    .update({ medical_acknowledged_at: new Date().toISOString(), medical_acknowledged_by: user.id })
    .eq("id", diverId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

export async function saveEquipmentNotes(diverId: string, notes: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("divers")
    .update({ equipment_notes: notes.trim() || null })
    .eq("id", diverId)
    .eq("dive_center_id", user.diveCenterId);
  if (error) return fail(error.message);
  return ok();
}

// ── Push to schedule ──
//
// Tags each diver's experience type by ensuring/updating an open visit —
// the real, functional signal Scheduling's diver pool reads (see the plan:
// the live app's schedule_divers null-schedule_id write is confirmed dead
// code there, never read back by scheduling.html; the visits row is what
// actually matters). No schedule_divers row is written here — that only
// happens once a diver is assigned to a specific trip in Scheduling.
export async function addDiversToSchedule(
  tags: { diverId: string; experienceType: "fun_diving" | "dive_course"; courseRateId: string | null }[],
): Promise<{ error?: string; addedCount?: number }> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (tags.some((t) => t.experienceType === "dive_course" && !t.courseRateId)) {
    return fail("Select a course for every diver tagged as Dive Course.");
  }

  const diverIds = tags.map((t) => t.diverId);
  const { data: existingVisits } = await supabase
    .from("visits")
    .select("id, diver_id, experience_type, course_rate_id, created_at")
    .in("diver_id", diverIds)
    .eq("is_active", true)
    .eq("visit_status", "open")
    .order("created_at", { ascending: false });

  const openVisitByDiver = new Map<string, { id: string; experienceType: string; courseRateId: string | null }>();
  (existingVisits ?? []).forEach((v) => {
    if (!openVisitByDiver.has(v.diver_id)) {
      openVisitByDiver.set(v.diver_id, { id: v.id, experienceType: v.experience_type, courseRateId: v.course_rate_id });
    }
  });

  let addedCount = 0;
  for (const t of tags) {
    const existing = openVisitByDiver.get(t.diverId);
    if (existing) {
      if (existing.experienceType !== t.experienceType || existing.courseRateId !== t.courseRateId) {
        const { error } = await supabase
          .from("visits")
          .update({
            experience_type: t.experienceType,
            course_rate_id: t.experienceType === "dive_course" ? t.courseRateId : null,
          })
          .eq("id", existing.id);
        if (error) return fail(`Could not update a diver's visit: ${error.message}`);
      }
      continue;
    }

    const { error } = await supabase.from("visits").insert({
      dive_center_id: user.diveCenterId,
      diver_id: t.diverId,
      experience_type: t.experienceType,
      course_rate_id: t.experienceType === "dive_course" ? t.courseRateId : null,
      visit_status: "open",
      is_active: true,
      is_paid: false,
    });
    if (error) return fail(`Could not start a visit for one diver: ${error.message}`);
    addedCount++;
  }

  revalidatePath("/divers");
  revalidatePath("/scheduling");
  return { addedCount };
}
