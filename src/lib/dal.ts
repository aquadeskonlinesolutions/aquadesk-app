import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  diveCenterId: string;
  fullName: string;
  email: string;
  role: "owner" | "secretary";
  canViewRevenue: boolean;
  isActive: boolean;
  passwordChanged: boolean;
  boatManifestEnabled: boolean;
  paddleBillingEnabled: boolean;
};

// Centralizes the "who is this and are they allowed here" check. Optimistic
// routing lives in proxy.ts; this is the real check every page/action/query
// should go through — and RLS in Postgres is the layer beneath even this.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select(
      "id, dive_center_id, full_name, email, role, can_view_revenue, is_active, password_changed",
    )
    .eq("id", user.id)
    .single();

  if (error || !profile || !profile.is_active) {
    redirect("/login");
  }

  // Recheck on every load, not just at sign-in — a dive center can be
  // suspended mid-session, same "recheck every time" precedent as the
  // password_changed check just above.
  const { data: dc } = await supabase
    .from("dive_centers")
    .select("subscription_status, boat_manifest_enabled, paddle_billing_enabled")
    .eq("id", profile.dive_center_id)
    .single();

  if (dc && (dc.subscription_status === "suspended" || dc.subscription_status === "cancelled")) {
    await supabase.auth.signOut();
    redirect("/login?suspended=1");
  }

  if (!profile.password_changed) {
    redirect("/account/password");
  }

  return {
    id: profile.id,
    diveCenterId: profile.dive_center_id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    canViewRevenue: profile.can_view_revenue,
    isActive: profile.is_active,
    passwordChanged: profile.password_changed,
    boatManifestEnabled: dc?.boat_manifest_enabled ?? true,
    // Opt-in, unlike boat manifest above — defaults false, not true.
    paddleBillingEnabled: dc?.paddle_billing_enabled ?? false,
  };
});

// Every Settings Server Action re-checks this — the settings/layout.tsx
// redirect is optimistic UI, not the enforcement boundary (RLS's owner-write
// policies on the settings-tier tables are).
export async function requireOwner(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user.role !== "owner") {
    redirect("/dashboard");
  }
  return user;
}

// Reports is revenue-centric end to end (money in/out, commissions, join-ride
// balances) — matches the blueprint's stated permission ("Hidden unless
// can_view_revenue"), not the live app's partial-tab-visibility version of
// this page.
export async function requireRevenueAccess(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user.role !== "owner" && !user.canViewRevenue) {
    redirect("/dashboard");
  }
  return user;
}

// Boat Manifest is a Malapascua-specific Bureau of Customs requirement, not
// something every dive center needs as AquaDesk expands to other regions —
// the nav link hiding it is optimistic UI, this is the real boundary, same
// pattern as requireOwner/requireRevenueAccess above.
export async function requireBoatManifestEnabled(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user.boatManifestEnabled) {
    redirect("/dashboard");
  }
  return user;
}

export type CurrentPlatformAdmin = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
};

export const getCurrentPlatformAdmin = cache(
  async (): Promise<CurrentPlatformAdmin> => {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: admin, error } = await supabase
      .from("platform_admins")
      .select("id, user_id, full_name, email, is_active")
      .eq("user_id", user.id)
      .single();

    if (error || !admin || !admin.is_active) {
      redirect("/login");
    }

    return {
      id: admin.id,
      userId: admin.user_id,
      fullName: admin.full_name,
      email: admin.email,
    };
  },
);

// Figures out where a just-authenticated (or already-authenticated) visitor
// should land: platform admins go to the office console, dive-center users
// go to the app (or a forced password change first), anyone else is logged
// out entirely since they don't belong to either tier.
export async function resolveLandingPath(): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/login";

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (admin) return "/office";

  const { data: profile } = await supabase
    .from("users")
    .select("id, dive_center_id, is_active, password_changed")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_active) {
    const { data: dc } = await supabase
      .from("dive_centers")
      .select("subscription_status")
      .eq("id", profile.dive_center_id)
      .single();

    if (dc && (dc.subscription_status === "suspended" || dc.subscription_status === "cancelled")) {
      await supabase.auth.signOut();
      return "/login?suspended=1";
    }

    return profile.password_changed ? "/dashboard" : "/account/password";
  }

  return "/login";
}
