"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPlatformAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generateTempPassword(): string {
  // Not the deterministic/guessable scheme the live app used for staff
  // tokens (see Stage 1a security review) — a real random secret.
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export type CreateDiveCenterState =
  | { error: string; tempPassword?: undefined }
  | { error?: undefined; tempPassword: string; diveCenterName: string }
  | undefined;

export async function createDiveCenter(
  _prevState: CreateDiveCenterState,
  formData: FormData,
): Promise<CreateDiveCenterState> {
  // Defense in depth: the office route already guards this, but every
  // privileged Server Action re-checks for itself (Next.js data-security
  // guidance — proxy/route guards are not the last line of defense).
  await getCurrentPlatformAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim();

  if (!name || !ownerName || !ownerEmail) {
    return { error: "Dive center name, owner name, and owner email are required." };
  }

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
    });

  if (authError || !authUser.user) {
    return { error: `Could not create owner login: ${authError?.message ?? "unknown error"}` };
  }

  const { data: diveCenter, error: dcError } = await admin
    .from("dive_centers")
    .insert({ name, email: email || null, phone: phone || null })
    .select("id")
    .single();

  if (dcError || !diveCenter) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { error: `Could not create dive center: ${dcError?.message ?? "unknown error"}` };
  }

  const { error: userError } = await admin.from("users").insert({
    id: authUser.user.id,
    dive_center_id: diveCenter.id,
    full_name: ownerName,
    email: ownerEmail,
    role: "owner",
    can_view_revenue: true,
  });

  if (userError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    await admin.from("dive_centers").delete().eq("id", diveCenter.id);
    return { error: `Could not create owner profile: ${userError.message}` };
  }

  revalidatePath("/office");
  return { tempPassword, diveCenterName: name };
}

export async function updateSubscriptionStatus(
  diveCenterId: string,
  status: "trial" | "active" | "suspended" | "cancelled",
) {
  await getCurrentPlatformAdmin();

  const supabase = await createClient();
  // Platform admin's own session — RLS + the enforce_dive_center_update_scope
  // trigger already restrict this to billing/status fields only.
  await supabase
    .from("dive_centers")
    .update({ subscription_status: status })
    .eq("id", diveCenterId);

  revalidatePath("/office");
}
