"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveLandingPath } from "@/lib/dal";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Ported from the live app's login-guard Edge Function
// (supabase/functions/login-guard/index.ts) — same 5-attempt/30-minute
// policy, now three SECURITY DEFINER RPCs instead of a separate Edge
// Function (see database/014_login_lockout.sql for why).
function lockoutMessage(retryAfterSeconds: number | undefined) {
  const mins = Math.max(1, Math.ceil((retryAfterSeconds || 1800) / 60));
  return `Too many failed attempts. This account is locked for ${mins} more minute${mins === 1 ? "" : "s"}. Please try again later.`;
}

export type SignInState = { error?: string } | undefined;

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { data: guard } = await supabase.rpc("login_guard_check", { p_email: email });
  if (guard && guard.allowed === false) {
    return { error: lockoutMessage(guard.retry_after_seconds) };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const { data: failResult } = await supabase.rpc("login_guard_fail", { p_email: email });
    if (failResult && failResult.locked) {
      return { error: lockoutMessage(failResult.retry_after_seconds) };
    }
    return { error: "Invalid email or password." };
  }

  await supabase.rpc("login_guard_reset", { p_email: email });

  redirect(await resolveLandingPath());
}

export type RequestResetState = { message?: string; error?: string } | undefined;

// Always returns a generic message regardless of whether the email exists
// or whether the account is currently locked — same anti-enumeration intent
// as the login-guard RPCs themselves. Password reset uses Supabase Auth's
// own built-in email sending; no separate email provider needed.
export async function requestPasswordReset(
  _prevState: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();

  const { data: guard } = await supabase.rpc("login_guard_check", { p_email: email });
  if (guard && guard.allowed === false) {
    return { error: "Password reset is unavailable until the lockout expires." };
  }

  const origin = (await headers()).get("origin") ?? "";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  return { message: "If that email is registered, a reset link is on its way." };
}
