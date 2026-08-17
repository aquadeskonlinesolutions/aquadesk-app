import type { NextRequest } from "next/server";
import { getPaddleInstance } from "@/lib/paddle/server";
import { processEvent } from "@/lib/paddle/process-webhook";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET ?? "";

  // Cheap pre-check: a request with no signature header or empty body can't
  // be verified at all. 400 is fine — Paddle still retries.
  if (!signature || !rawBody) {
    return Response.json({ error: "Missing signature or body" }, { status: 400 });
  }

  try {
    const paddle = getPaddleInstance();
    // Throws on signature mismatch, expired timestamp, or a malformed
    // payload — nothing below this line runs, and no customData is ever
    // read, unless this succeeds.
    const event = await paddle.webhooks.unmarshal(rawBody, secret, signature);

    if (event) {
      await processEvent(event);
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error("Paddle webhook error:", e);
    // One non-2xx for the whole catch, deliberately not split into
    // "signature failure -> 401" vs "handler error -> 500" — unmarshal
    // throws identically for a tampered request, a rotated secret, and a
    // malformed event, so there's no reliable way to tell those apart here.
    // Any non-2xx keeps Paddle retrying on the same budget; only a 2xx
    // would mark a failed delivery as done and lose the event.
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
