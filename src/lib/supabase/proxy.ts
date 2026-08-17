import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api/webhooks/paddle is a server-to-server callback from Paddle — no
// browser session, no cookie, ever. It authenticates itself via the
// Paddle-Signature header (verified inside the route), not this cookie
// check, so it must never redirect to /login the way a real logged-out
// visitor would.
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/account/password",
  "/staff",
  "/reset-password",
  "/api/webhooks/paddle",
];

// Real idle-timeout session expiry — the user's explicit ask, since
// Supabase's own session cookies otherwise auto-refresh forever (there's
// no built-in expiry without a paid-tier setting, and even the JWT-expiry
// dashboard setting doesn't force a logout — the refresh token just
// silently renews the access token in the background). This is tracked
// entirely app-side via a plain server-only cookie storing the last
// authenticated request's timestamp, reset on every request; no schema
// change, no Supabase config change, works on any tier.
const LAST_SEEN_COOKIE = "aquadesk_last_seen";
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

// Optimistic auth check only (cookie-based, no DB round trip) — the real
// authorization boundary is Postgres RLS, this just redirects logged-out
// users away from app routes and logged-in users away from /login.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  // Idle-timeout check — applies to any authenticated request on a
  // protected route (owners, secretaries, and platform admins alike).
  // Skipped on public routes so it can never interfere with anonymous
  // access to /login, /register, /staff, etc.
  if (user && !isPublicRoute) {
    const lastSeenRaw = request.cookies.get(LAST_SEEN_COOKIE)?.value;
    const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : null;
    const now = Date.now();

    if (lastSeen && now - lastSeen > IDLE_TIMEOUT_MS) {
      // signOut() mutates `response` (via the setAll callback above) to
      // clear the real Supabase session cookies — build the redirect from
      // that same response so the clearing actually takes effect, rather
      // than a fresh NextResponse.redirect() that would carry none of it.
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      loginUrl.searchParams.set("timeout", "1");
      const redirectResponse = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      redirectResponse.cookies.delete(LAST_SEEN_COOKIE);
      return redirectResponse;
    }

    response.cookies.set(LAST_SEEN_COOKIE, String(now), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.ceil(IDLE_TIMEOUT_MS / 1000) + 60,
    });
  }

  if (!user && !isPublicRoute && pathname !== "/") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Matches the old app's login.html: a valid session alone doesn't skip
  // the login form — only a valid session AND a prior "remember me" both
  // do. Visiting /login with a live-but-not-remembered session (e.g. this
  // browser wasn't the one "remembered" at last sign-in) shows the form
  // again rather than silently bouncing straight into the app.
  const remembered = request.cookies.get("aquadesk_remember")?.value === "true";
  if (user && remembered && pathname === "/login") {
    // Root page.tsx does the real "where does this user belong" check
    // (platform admin vs. dive-center user vs. forced password change).
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
