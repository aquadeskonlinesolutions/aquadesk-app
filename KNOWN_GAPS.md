# Known Gaps

Tracks anything intentionally left incomplete while building a page, so it
doesn't get lost in chat history. Default is to finish each page fully
before moving on — an entry here means there was a real reason it couldn't
be (usually: needs a decision only the client can make, or depends on
infrastructure not built yet).

Format per entry: page/feature, what's missing, why, what finishing it
would require. Remove the entry once it's resolved.

## Open

### Dashboard: one old alert type not reproduced

The live app's Dashboard had 6 alert checks; this rebuild's Dashboard
(`src/app/(app)/dashboard/data.ts`) has 5 — "government fees not logged
today" was restored once Reports' build fixed the `govt_fees` table to
match what this alert always expected (see `database/006_govt_fees_daily_log.sql`).

**"Another boat joined us today, not yet logged."** The live app detected
this by parsing a JSON blob in `schedules.notes` (`joinerDivers`/`joinerDC`
keys) set at schedule-creation time. The new schema replaced that
notes-JSON pattern with explicit columns (`schedules.is_joiner`,
`schedules.joiner_boat_name`) — but only for the "we joined someone
else's boat" direction. There's no equivalent signal captured anywhere
for the reverse direction (another dive center's divers joining our
boat) until Scheduling is built and defines how that gets entered.

Commented in `data.ts` above `loadAlerts()`. Revisit when Scheduling is
built — don't guess a workaround before then.

### Settings: no page for dive center profile (name/address/phone/logo)

The live app's Settings had a "Profile" tab (dive center name, email,
phone, address, logo upload, subscription status display, plus the
insurance fields). The new app's 5-tab Settings structure (Pricing &
Rates, Staff Access, Waiver & Registration, Equipment, Integrations —
all now built) has no tab that covers this at all. The insurance fields
found a home in Integrations; the rest (name/email/phone/address/logo)
currently has no edit path anywhere after initial creation via the
`/office` platform admin console.

Not fixed now because it wasn't part of the 5-tab scope the user asked
for and adding it means a real design call (a 6th tab? fold into an
existing one? does it need its own page outside Settings?) plus a new
concern (logo upload needs its own Storage bucket + policies, same class
of setup as the cert-card bucket in `003_cert_card_storage.sql`). Flagging
so it doesn't get lost — a dive center will eventually want to update its
name, phone, or logo, and there's currently nowhere in the app to do that.

### Boat Manifest: no offline support

The blueprint's page map (`aquadesk-rebuild-blueprint-v1.md`, Stage 1b)
describes Boat Manifest as "offline-cacheable" — boats are often at sea
with no signal. This rebuild's version (`src/app/(app)/boat-manifest/`)
has no service worker, cache strategy, or offline queueing at all — a
plain server-rendered page like every other page in the app.

Not built because the live app's own `boat-manifest.html` doesn't
actually implement any offline support either (checked directly — it's a
plain page, same as this rebuild), so there's no behavioral reference to
match, and adding real offline support (service worker registration,
what to cache, how edits made offline get synced later) is an
architecture decision affecting the whole app's build, not something to
improvise into one page. Flagging since the blueprint calls it out
explicitly as a requirement this page doesn't meet yet.
