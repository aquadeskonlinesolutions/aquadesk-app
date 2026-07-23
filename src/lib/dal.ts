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
    .select("id, dive_center_id, full_name, email, role, can_view_revenue, is_active")
    .eq("id", user.id)
    .single();

  if (error || !profile || !profile.is_active) {
    redirect("/login");
  }

  return {
    id: profile.id,
    diveCenterId: profile.dive_center_id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    canViewRevenue: profile.can_view_revenue,
    isActive: profile.is_active,
  };
});
