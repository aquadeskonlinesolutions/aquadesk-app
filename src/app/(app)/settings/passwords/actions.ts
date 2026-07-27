"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

function ok() {
  revalidatePath("/settings/passwords");
  return { error: undefined };
}
function fail(message: string) {
  return { error: message };
}

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
