import "server-only";

const PADDLE_IPS_URL = "https://api.paddle.com/ips";
// Paddle's published IPs change rarely - refetching every request would be
// wasteful and adds latency to every webhook delivery for no benefit.
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedIps: string[] | null = null;
let cachedAt = 0;

async function getAllowedIps(): Promise<string[] | null> {
  const now = Date.now();
  if (cachedIps && now - cachedAt < CACHE_TTL_MS) {
    return cachedIps;
  }
  try {
    const res = await fetch(PADDLE_IPS_URL);
    if (!res.ok) throw new Error(`Paddle IP list fetch failed with status ${res.status}`);
    const body = (await res.json()) as { data: { ipv4_cidrs: string[] } };
    // Every entry Paddle publishes today is a /32 (a single host) - strip
    // the suffix for a plain equality check. If Paddle ever publishes a
    // wider range this needs a real CIDR-match instead of string equality.
    cachedIps = body.data.ipv4_cidrs.map((cidr) => cidr.replace(/\/32$/, ""));
    cachedAt = now;
    return cachedIps;
  } catch (e) {
    console.error("Failed to fetch Paddle webhook IP allowlist:", e);
    // Serve a stale cache rather than nothing - a transient fetch failure
    // shouldn't drop every incoming webhook delivery.
    return cachedIps;
  }
}

// Defense-in-depth on top of Paddle-Signature verification (the actual
// security boundary - see route.ts, which never trusts a payload until
// paddle.webhooks.unmarshal() succeeds regardless of source IP). If the
// allowlist has never been successfully fetched (e.g. a cold start hitting
// a transient network error), this fails open rather than rejecting every
// legitimate delivery - signature verification still protects the handler
// either way.
export async function isAllowedPaddleIp(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const allowed = await getAllowedIps();
  if (!allowed) return true;
  return allowed.includes(ip);
}
