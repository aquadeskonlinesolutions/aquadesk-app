import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SecretaryAccount = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  can_view_revenue: boolean;
};

export type AccessData = {
  secretaries: SecretaryAccount[];
};

export async function loadAccessData(diveCenterId: string): Promise<AccessData> {
  const supabase = await createClient();
  const { data: secretaries } = await supabase
    .from("users")
    .select("id, full_name, email, is_active, can_view_revenue")
    .eq("dive_center_id", diveCenterId)
    .eq("role", "secretary")
    .order("full_name");

  return { secretaries: secretaries ?? [] };
}
