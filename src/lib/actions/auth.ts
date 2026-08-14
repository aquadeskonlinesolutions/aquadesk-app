"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveLandingPath } from "@/lib/dal";

// Matches the old app's login.html localStorage "remember me" flag —
// ported as a cookie (not localStorage) since the gate it controls,
// /login redirecting an already-authenticated visitor straight into the
// app, is enforced server-side in proxy.ts, which can only read cookies.
// A year-long expiry mirrors the old app's flag, which never expired on
// its own either — only an explicit non-remembered login clears it.
const REMEMBER_COOKIE = "aquadesk_remember";
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

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
  const remember = formData.get("remember") === "true";

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

  const cookieStore = await cookies();
  if (remember) {
    cookieStore.set(REMEMBER_COOKIE, "true", {
      maxAge: REMEMBER_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  } else {
    // Matches the old app: signing in without "remember me" explicitly
    // un-remembers this browser, not just leaves the flag untouched.
    cookieStore.delete(REMEMBER_COOKIE);
  }

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
