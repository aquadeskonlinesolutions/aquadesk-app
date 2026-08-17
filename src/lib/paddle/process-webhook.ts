import "server-only";
import {
  EventName,
  type EventEntity,
  type SubscriptionActivatedEvent,
  type SubscriptionCreatedEvent,
  type SubscriptionUpdatedEvent,
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
type MatchedStatus = typeof STATUS_ACTIVE | typeof STATUS_CANCELLED | typeof STATUS_SUSPENDED;

// Paddle delivers at-least-once and retries on any non-2xx — every handler
// here is a plain idempotent UPDATE (repeated deliveries just re-apply the
// same state), so no separate event-id dedup ledger is needed, as long as
// each handler actually throws when it fails to find/update a row (a Supabase
// update matching zero rows returns error: null, not an error — see
// setStatusBySubscriptionId).
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
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionActivated:
      return reconcileToActive(event);
    default:
      // Subscribed to events this route doesn't act on yet. No-op, not an error.
      return;
  }
}

// transaction.completed and subscription.created are the only events that
// originate from a Checkout.open() call carrying our own customData — every
// later lifecycle event (canceled, past_due, updated/activated, future
// renewals) has to be matched by the subscription id stored on the
// dive_centers row instead, since Paddle-initiated events never carry
// checkout-time customData.
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

// The only path back from "suspended" (subscription.past_due) — a renewal
// transaction carries no customData (it's Paddle-initiated, not a
// Checkout.open() call), so without this, a dive center that gets suspended
// for a failed payment stays suspended forever even after the retry
// succeeds and the customer is being billed again. subscription.updated
// fires for plenty of unrelated changes (items, discounts, etc.), so this
// only acts when the event's own status says the subscription is actually
// active again — never blindly on every update.
async function reconcileToActive(event: SubscriptionUpdatedEvent | SubscriptionActivatedEvent) {
  if (event.data.status !== "active") return;
  return setStatusBySubscriptionId(event.data.id, STATUS_ACTIVE);
}

async function setStatusBySubscriptionId(subscriptionId: string, status: MatchedStatus) {
  const supabase = createAdminClient();
  // .select("id") is required here, not cosmetic — a Supabase UPDATE that
  // matches zero rows returns { error: null, data: null }, not an error. Left
  // unchecked, an event for an unmatched/stale subscription id would silently
  // "succeed" (200 to Paddle, no retry) while the intended status change is
  // permanently lost with no log or alert.
  const { data, error } = await supabase
    .from("dive_centers")
    .update({ subscription_status: status })
    .eq("paddle_subscription_id", subscriptionId)
    .select("id");

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`No dive_center found for paddle_subscription_id=${subscriptionId}`);
  }
}
