"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SetPasswordState = { error?: string } | undefined;

export async function setPassword(
  _prevState: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return { error: "Could not update password. Please try again." };
  }

  // Only dive-center users (owner/secretary) track password_changed —
  // platform admins have no row in `users`, so this is a no-op for them.
  await supabase
    .from("users")
    .update({ password_changed: true })
    .eq("id", user.id);

  redirect("/");
}
