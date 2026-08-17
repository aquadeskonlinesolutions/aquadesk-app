import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionClient } from "./SubscriptionClient";

export default async function SettingsSubscriptionPage() {
  const user = await requireOwner();
  const supabase = await createClient();

  const { data: dc } = await supabase
    .from("dive_centers")
    .select("subscription_status")
    .eq("id", user.diveCenterId)
    .single();

  return (
    <SubscriptionClient
      email={user.email}
      subscriptionStatus={dc?.subscription_status ?? "trial"}
    />
  );
}
