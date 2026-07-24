import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SecretaryAccount = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  can_view_revenue: boolean;
};

export type StaffAccessData = {
  secretaries: SecretaryAccount[];
  hasOwnerPassword: boolean;
  hasBillingPassword: boolean;
};

export async function loadStaffAccessData(diveCenterId: string): Promise<StaffAccessData> {
  const supabase = await createClient();

  const [{ data: secretaries }, { data: dc }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, is_active, can_view_revenue")
      .eq("dive_center_id", diveCenterId)
      .eq("role", "secretary")
      .order("full_name"),
    supabase
      .from("dive_centers")
      .select("owner_unlock_hash, billing_unlock_hash")
      .eq("id", diveCenterId)
      .single(),
  ]);

  return {
    secretaries: secretaries ?? [],
    hasOwnerPassword: !!dc?.owner_unlock_hash,
    hasBillingPassword: !!dc?.billing_unlock_hash,
  };
}
