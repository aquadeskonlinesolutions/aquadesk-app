"use server";

import { revalidatePath } from "next/cache";
import { requireRevenueAccess } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { loadOverviewData, loadStaffActivityData } from "./data";

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
