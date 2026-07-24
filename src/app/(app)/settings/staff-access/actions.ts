"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function ok() {
  revalidatePath("/settings/staff-access");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

function generateTempPassword(): string {
  // Not the fixed, shared "aquadesk123" the live app used for every new
  // secretary — a real random secret, same approach as office.ts's
  // dive-center owner creation.
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export type CreateSecretaryResult =
  | { error: string; tempPassword?: undefined }
  | { error?: undefined; tempPassword: string };

export async function createSecretary(
  fullName: string,
  email: string,
): Promise<CreateSecretaryResult> {
  const user = await requireOwner();
  if (!fullName.trim()) return fail("Full name is required.");
  if (!email.trim()) return fail("Email address is required.");

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password: tempPassword,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    return fail(`Could not create login: ${authError?.message ?? "unknown error"}`);
  }

  const { error: userError } = await admin.from("users").insert({
    id: authUser.user.id,
    dive_center_id: user.diveCenterId,
    full_name: fullName.trim(),
    email: email.trim(),
    role: "secretary",
    can_view_revenue: false,
    is_active: true,
    password_changed: false,
  });
  if (userError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return fail(`Could not create secretary profile: ${userError.message}`);
  }

  revalidatePath("/settings/staff-access");
  return { tempPassword };
}

export async function resetSecretaryPassword(
  secretaryUserId: string,
): Promise<CreateSecretaryResult> {
  const user = await requireOwner();
  const admin = createAdminClient();

  // Confirm this account actually belongs to the owner's own dive center
  // before touching it via the service-role client.
  const { data: secretary } = await admin
    .from("users")
    .select("id, dive_center_id, role")
    .eq("id", secretaryUserId)
    .single();
  if (!secretary || secretary.dive_center_id !== user.diveCenterId || secretary.role !== "secretary") {
    return fail("Secretary account not found.");
  }

  const tempPassword = generateTempPassword();
  const { error: authError } = await admin.auth.admin.updateUserById(secretaryUserId, {
    password: tempPassword,
  });
  if (authError) return fail(authError.message);

  await admin.from("users").update({ password_changed: false }).eq("id", secretaryUserId);

  revalidatePath("/settings/staff-access");
  return { tempPassword };
}

export async function toggleSecretaryActive(secretaryUserId: string, isActive: boolean) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ is_active: isActive })
    .eq("id", secretaryUserId)
    .eq("dive_center_id", user.diveCenterId)
    .eq("role", "secretary");
  if (error) return fail(error.message);
  return ok();
}

export async function toggleRevenueVisibility(secretaryUserId: string, canView: boolean) {
  const user = await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ can_view_revenue: canView })
    .eq("id", secretaryUserId)
    .eq("dive_center_id", user.diveCenterId)
    .eq("role", "secretary");
  if (error) return fail(error.message);
  return ok();
}

// ── OWNER / BILLING PASSWORDS ────────────────────────────────────────────
// The live app's version of these two forms always demanded a matching
// "current password" before allowing a save — including the very first
// time, when no password had ever been set, which made it impossible to
// ever set one at all. Fixed here to match the obvious intent: no current
// password required the first time; required and verified on every change
// after that.

export async function setOwnerPassword(
  currentPassword: string,
  newPassword: string,
  hadPassword: boolean,
) {
  const user = await requireOwner();
  if (newPassword.length < 6) return fail("New password must be at least 6 characters.");
  const supabase = await createClient();

  if (hadPassword) {
    const { data: verified, error: verifyError } = await supabase.rpc("verify_owner_unlock", {
      p_dive_center_id: user.diveCenterId,
      p_attempt: currentPassword,
    });
    if (verifyError) return fail(verifyError.message);
    if (!verified) return fail("Current password is incorrect.");
  }

  const { error } = await supabase.rpc("set_owner_unlock", {
    p_dive_center_id: user.diveCenterId,
    p_secret: newPassword,
  });
  if (error) return fail(error.message);
  return ok();
}

export async function setBillingPassword(
  currentPassword: string,
  newPassword: string,
  hadPassword: boolean,
) {
  const user = await requireOwner();
  if (newPassword.length < 6) return fail("New password must be at least 6 characters.");
  const supabase = await createClient();

  if (hadPassword) {
    const { data: verified, error: verifyError } = await supabase.rpc("verify_billing_unlock", {
      p_dive_center_id: user.diveCenterId,
      p_attempt: currentPassword,
    });
    if (verifyError) return fail(verifyError.message);
    if (!verified) return fail("Current password is incorrect.");
  }

  const { error } = await supabase.rpc("set_billing_unlock", {
    p_dive_center_id: user.diveCenterId,
    p_secret: newPassword,
  });
  if (error) return fail(error.message);
  return ok();
}
