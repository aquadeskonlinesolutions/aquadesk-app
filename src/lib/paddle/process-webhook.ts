import "server-only";
import {
  EventName,
  type EventEntity,
  type SubscriptionCreatedEvent,
  type TransactionCompletedEvent,
} from "@paddle/paddle-node-sdk";
import { createAdminClient } from "@/lib/supabase/admin";

// Paddle's own event/enum spelling is American ("canceled") — this app's
// dive_centers.subscription_status enum (001_schema_and_rls.sql) uses
// British ("cancelled"), inherited from the live app's original schema.
// Bridge explicitly here rather than assuming the strings line up.
const STATUS_ACTIVE = "active";
const STATUS_CANCELLED = "cancelled";
const STATUS_SUSPENDED = "suspended";

// Paddle delivers at-least-once and retries on any non-2xx — every handler
// here is a plain idempotent UPDATE (repeated deliveries just re-apply the
// same state), so no separate event-id dedup ledger is needed.
export async function processEvent(event: EventEntity): Promise<void> {
  switch (event.eventType) {
    case EventName.TransactionCompleted:
      return activateByCustomData(event);
    case EventName.SubscriptionCreated:
      return activateByCustomData(event);
    case EventName.SubscriptionCanceled:
      return setStatusBySubscriptionId(event.data.id, STATUS_CANCELLED);
    case EventName.SubscriptionPastDue:
      return setStatusBySubscriptionId(event.data.id, STATUS_SUSPENDED);
    default:
      // Subscribed to events this route doesn't act on yet. No-op, not an error.
      return;
  }
}

// transaction.completed and subscription.created are the only events that
// originate from a Checkout.open() call carrying our own customData — every
// later lifecycle event (canceled, past_due, future renewals) has to be
// matched by the subscription id stored on the dive_centers row instead,
// since Paddle-initiated renewal events never carry checkout-time customData.
async function activateByCustomData(event: TransactionCompletedEvent | SubscriptionCreatedEvent) {
  const diveCenterId = event.data.customData?.aquadesk_dive_center_id;
  if (typeof diveCenterId !== "string" || !diveCenterId) {
    console.error(
      `Paddle ${event.eventType} (${event.eventId}): missing/invalid aquadesk_dive_center_id in customData`,
    );
    return;
  }

  const subscriptionId = event.eventType === EventName.SubscriptionCreated ? event.data.id : event.data.subscriptionId;
  const customerId = event.data.customerId;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("dive_centers")
    .update({
      subscription_status: STATUS_ACTIVE,
      ...(subscriptionId ? { paddle_subscription_id: subscriptionId } : {}),
      ...(customerId ? { paddle_customer_id: customerId } : {}),
    })
    .eq("id", diveCenterId);

  if (error) throw error;
}

async function setStatusBySubscriptionId(
  subscriptionId: string,
  status: typeof STATUS_CANCELLED | typeof STATUS_SUSPENDED,
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("dive_centers")
    .update({ subscription_status: status })
    .eq("paddle_subscription_id", subscriptionId);

  if (error) throw error;
}
