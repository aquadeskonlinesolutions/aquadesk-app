import { requireOwner } from "@/lib/dal";
import { PaddleVerifyClient } from "./PaddleVerifyClient";

// Deliberately unlinked from nav and NOT gated by
// isSubscriptionTabEnabled()/NEXT_PUBLIC_SUBSCRIPTION_TAB_ENABLED - this
// exists so Paddle's domain approval and default-payment-link setup have
// somewhere real to point at, independent of whether the Subscription tab
// itself is open to real customers yet. Reachable only while logged in as
// an owner - requireOwner() is the real boundary, same as every other
// owner-only page in this app; the lack of a nav link is optimistic only.
export default async function PaddleVerifyPage() {
  const user = await requireOwner();

  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white px-4">
      <PaddleVerifyClient email={user.email} />
    </div>
  );
}
