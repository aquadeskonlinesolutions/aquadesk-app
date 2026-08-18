import type { NextRequest } from "next/server";
import { getPaddleInstance } from "@/lib/paddle/server";
import { processEvent } from "@/lib/paddle/process-webhook";
import { isAllowedPaddleIp } from "@/lib/paddle/webhook-ip-allowlist";

export async function POST(request: NextRequest) {
  // Gated to production only: sandbox testing (including local dev via a
  // cloudflared tunnel, which doesn't set cf-connecting-ip the way
  // Cloudflare's own edge does) must keep working unaffected. This is
  // defense-in-depth, not the security boundary - see the signature check
  // below, which is what actually authenticates a delivery.
  if (process.env.NEXT_PUBLIC_PADDLE_ENV === "production") {
    const clientIp = request.headers.get("cf-connecting-ip");
    if (!(await isAllowedPaddleIp(clientIp))) {
      console.error(`Paddle webhook error: rejected request from disallowed IP ${clientIp ?? "(missing)"}`);
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET;

  // Cheap pre-check: a request with no signature header or empty body can't
  // be verified at all. 400 is fine — Paddle still retries.
  if (!signature || !rawBody) {
    return Response.json({ error: "Missing signature or body" }, { status: 400 });
  }

  // A missing secret would otherwise silently coerce to "" and make every
  // delivery fail unmarshal with the exact same log line as a genuinely
  // tampered request or rotated secret — logged distinctly here so a
  // misconfigured deploy is diagnosable instead of looking like an attack.
  // Response to Paddle is still the same generic non-2xx either way (see catch
  // below) — this only changes what shows up in our own logs.
  if (!secret) {
    console.error("Paddle webhook error: PADDLE_NOTIFICATION_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Internal error" }, { status: 500 });
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
