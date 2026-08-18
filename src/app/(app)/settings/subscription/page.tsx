import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isSubscriptionTabEnabled } from "@/lib/featureFlags";
import { SubscriptionClient } from "./SubscriptionClient";

export default async function SettingsSubscriptionPage() {
  const user = await requireOwner();

  // Real enforcement boundary, not just the nav link being hidden — matches
  // requireBoatManifestEnabled's "hiding the tab is optimistic UI" pattern.
  // Same redirect target settings/page.tsx's own index route already uses.
  // Both the build-time global kill switch and this dive center's own
  // paddle_billing_enabled opt-in must be true — most customers stay on
  // manual bank-transfer billing, so the per-dive-center flag defaults off.
  if (!isSubscriptionTabEnabled() || !user.paddleBillingEnabled) {
    redirect("/settings/pricing");
  }

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
