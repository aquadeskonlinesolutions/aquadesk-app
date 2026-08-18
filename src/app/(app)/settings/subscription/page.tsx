import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isSubscriptionTabEnabled } from "@/lib/featureFlags";
import { SubscriptionClient } from "./SubscriptionClient";

export default async function SettingsSubscriptionPage() {
  // Real enforcement boundary, not just the nav link being hidden — matches
  // requireBoatManifestEnabled's "hiding the tab is optimistic UI" pattern.
  // Same redirect target settings/page.tsx's own index route already uses.
  if (!isSubscriptionTabEnabled()) {
    redirect("/settings/pricing");
  }

  const user = await requireOwner();
  const supabase = await createClient();

  const { data: dc } = await supabase
    .from("dive_centers")
    .select("subscription_status, paddle_customer_id")
    .eq("id", user.diveCenterId)
    .single();

  return (
    <SubscriptionClient
      email={user.email}
      subscriptionStatus={dc?.subscription_status ?? "trial"}
      paddleCustomerId={dc?.paddle_customer_id ?? null}
    />
  );
}
