"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getCurrentPlatformAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_COURSES } from "@/app/(app)/settings/courses/constants";

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
  const address = String(formData.get("address") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim();
  const pricingMode = String(formData.get("pricingMode") ?? "");

  if (!name || !ownerName || !ownerEmail) {
    return { error: "Dive center name, owner name, and owner email are required." };
  }
  // pricing_mode has a schema-level default ('tier'), but that default must
  // never be what actually lands on a real dive center — it's a deliberate
  // business decision (tier-based per-dive rates vs. flat package pricing),
  // not something safe to assume. Require an explicit choice here rather
  // than letting the column's own default silently stand in for one.
  if (pricingMode !== "tier" && pricingMode !== "package") {
    return { error: "Pricing mode (tier-based or package-based) is required." };
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
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      pricing_mode: pricingMode,
    })
    .select("id")
    .single();

  if (dcError || !diveCenter) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { error: `Could not create dive center: ${dcError?.message ?? "unknown error"}` };
  }

  // Tier mode needs course rates to price course visits at all — Settings >
  // Pricing & Rates' own confirmPricingMode seeds the same defaults when an
  // owner switches into tier mode later; do the same here so a fresh
  // tier-mode dive center isn't missing them from day one.
  if (pricingMode === "tier") {
    await admin.from("course_rates").insert(
      DEFAULT_COURSES.map((c) => ({
        dive_center_id: diveCenter.id,
        course_name: c.name,
        rate: c.rate,
        is_active: true,
      })),
    );
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

// Boat Manifest is a Malapascua-specific (Bureau of Customs) requirement —
// this is how it gets turned on for new regions during onboarding.
// enforce_dive_center_update_scope (migration 039) already allowlists this
// column for platform-admin writes, same as the billing/status fields above.
export async function updateBoatManifestEnabled(diveCenterId: string, enabled: boolean) {
  await getCurrentPlatformAdmin();

  const supabase = await createClient();
  await supabase
    .from("dive_centers")
    .update({ boat_manifest_enabled: enabled })
    .eq("id", diveCenterId);

  revalidatePath("/office");
}

// Per-dive-center opt-in to Paddle self-serve billing, separate from the
// global NEXT_PUBLIC_SUBSCRIPTION_TAB_ENABLED build-time kill switch — most
// customers stay on manual bank-transfer billing to avoid Paddle's fees.
// enforce_dive_center_update_scope (migration 040) already allowlists this
// column for platform-admin writes, same as boat_manifest_enabled above.
export async function updatePaddleBillingEnabled(diveCenterId: string, enabled: boolean) {
  await getCurrentPlatformAdmin();

  const supabase = await createClient();
  await supabase
    .from("dive_centers")
    .update({ paddle_billing_enabled: enabled })
    .eq("id", diveCenterId);

  revalidatePath("/office");
}

export type StartBillingState = { error?: string } | undefined;

export async function startBilling(
  diveCenterId: string,
  _prevState: StartBillingState,
  formData: FormData,
): Promise<StartBillingState> {
  await getCurrentPlatformAdmin();

  const dueDate = String(formData.get("dueDate") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!dueDate) return { error: "Due date is required." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dive_centers")
    .update({
      billing_due_date: dueDate,
      billing_amount: amount,
      subscription_status: "active",
    })
    .eq("id", diveCenterId);

  if (error) return { error: error.message };

  revalidatePath("/office");
  return {};
}

// AquaDesk's dive centers operate in the Philippines — "today" for
// last_payment_date must be anchored to Asia/Manila, matching every other
// day-boundary check in this app (see dashboard/data.ts's manilaDateStr).
function manilaTodayStr(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

// billing_due_date is a plain calendar date (no time/timezone component at
// all) — advancing it by a month must stay pure Y-M-D arithmetic. Routing
// this through a JS Date's local-time fields and back via toISOString()
// silently shifts the result a day earlier whenever the server's local
// timezone is ahead of UTC (true for Asia/Manila, UTC+8) — exactly the
// naive-UTC-conversion trap this project's day-boundary conventions exist
// to avoid. Clamps the day for months with fewer days (e.g. Jan 31 -> Feb 28).
function addOneMonthToDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const daysInNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInNextMonth);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

// Billing cycle is monthly (Service Agreement 3.1: ₱4,000/month, paid in
// advance before each billing month) — Mark as Paid advances the due date
// by exactly one month from whatever it was, not from today, so an early
// or late payment doesn't shift the cycle.
export async function markPaid(diveCenterId: string): Promise<{ error?: string }> {
  await getCurrentPlatformAdmin();

  const supabase = await createClient();
  const { data: dc, error: fetchError } = await supabase
    .from("dive_centers")
    .select("billing_due_date")
    .eq("id", diveCenterId)
    .single();

  if (fetchError || !dc?.billing_due_date) {
    return { error: "This dive center has no billing cycle started yet." };
  }

  const newDueDate = addOneMonthToDateStr(dc.billing_due_date);
  const paidOn = manilaTodayStr();

  const { error } = await supabase
    .from("dive_centers")
    .update({
      billing_due_date: newDueDate,
      last_payment_date: paidOn,
      subscription_status: "active",
    })
    .eq("id", diveCenterId);

  if (error) return { error: error.message };

  revalidatePath("/office");
  return {};
}

export async function sendOwnerResetLink(email: string): Promise<{ error?: string }> {
  await getCurrentPlatformAdmin();
  if (!email) return { error: "No owner email on file." };

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) return { error: error.message };
  return {};
}

// Unlocks any dive-center user's login — owner or secretary. login_guard_reset
// operates generically by email, not scoped to a role; the caller (office
// console) is what previously only ever surfaced this for the owner.
export async function unlockUserLogin(email: string): Promise<{ error?: string }> {
  await getCurrentPlatformAdmin();
  if (!email) return { error: "No email on file." };

  const supabase = await createClient();
  await supabase.rpc("login_guard_reset", { p_email: email });

  revalidatePath("/office");
  return {};
}
