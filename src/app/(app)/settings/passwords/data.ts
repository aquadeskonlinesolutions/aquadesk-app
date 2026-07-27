import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PasswordsData = {
  hasOwnerPassword: boolean;
  hasBillingPassword: boolean;
};

export async function loadPasswordsData(diveCenterId: string): Promise<PasswordsData> {
  const supabase = await createClient();
  const { data: dc } = await supabase
    .from("dive_centers")
    .select("owner_unlock_hash, billing_unlock_hash")
    .eq("id", diveCenterId)
    .single();

  return {
    hasOwnerPassword: !!dc?.owner_unlock_hash,
    hasBillingPassword: !!dc?.billing_unlock_hash,
  };
}
