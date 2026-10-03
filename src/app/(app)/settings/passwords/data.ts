import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PasswordsData = {
  hasOwnerPassword: boolean;
  hasBillingPassword: boolean;
};

// password_status (migration 050) returns only whether each password is
// set — the hash columns themselves are not readable by the app (051).
// It always answers for the signed-in user's own dive center.
export async function loadPasswordsData(): Promise<PasswordsData> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("password_status");
  const status = (data ?? {}) as { owner_set?: boolean; billing_set?: boolean };

  return {
    hasOwnerPassword: !!status.owner_set,
    hasBillingPassword: !!status.billing_set,
  };
}
