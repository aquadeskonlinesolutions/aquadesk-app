# Known Gaps

Tracks anything intentionally left incomplete while building a page, so it
doesn't get lost in chat history. Default is to finish each page fully
before moving on — an entry here means there was a real reason it couldn't
be (usually: needs a decision only the client can make, or depends on
infrastructure not built yet).

Format per entry: page/feature, what's missing, why, what finishing it
would require. Remove the entry once it's resolved.

## Open

### Cloudflare Workers deploy: proxy.ts must be manually excluded each time

`@opennextjs/cloudflare` (installed 2026-08-01, deploying to the
pre-prod Worker) doesn't support Next.js 16's `proxy.ts` yet — the
build fails outright with "Node.js middleware is not currently
supported." A real fix (`opennextjs/opennextjs-cloudflare#1309`) exists
as an open PR, not yet merged/released as of this writing.

Workaround, confirmed safe: rename `src/proxy.ts` out of the way,
`npm run cf:build`, rename it back immediately. Verified this doesn't
create a security gap — every protected route already does its own
independent auth check regardless of `proxy.ts`
(`(app)/layout.tsx`'s `getCurrentUser()`, `/office`'s
`getCurrentPlatformAdmin()`, `/account/password`'s `setPassword`
action) — `proxy.ts` is genuinely just an optimistic UX redirect on
top of those, per its own existing code comment. Confirmed live: a
logged-out visit to a protected route on the deployed Worker still
correctly redirects to `/login`.

To fix for real: watch `opennextjs/opennextjs-cloudflare#1309` for a
release, then remove the rename-dance from the deploy process (see
`CLAUDE.md`'s 2026-08-01 session write-up for the exact steps used).

### Divers > Group Management: no "Review & Apply Charges" bulk billing

The live app's `divers.html` has a bulk group-billing flow (`openBulkReview`,
`applyChargesForGroupDiver`) — pick a date range, review every group
member's activities/running bill, and bulk-compute+write per-activity
charges (dive-rate tiers, package prices, course prices, fuel/marine/
shark/nitrox/15L, equipment rental) across the whole group at once,
including a "which rate are we charging?" stepper for package-mode
ambiguous site groupings (persisted to `visit_rate_selections`).

Not built in the 2026-07-26 Divers-page rebuild — the new Group
Management tab (`src/app/(app)/divers/components/GroupManagementTab.tsx`)
covers group creation, the member card drill-down, and push-to-schedule,
but not this bulk-pricing review. It's a large, genuinely separate
feature (the same size class as the Diver Detail pricing engine already
built at `diver-form/[id]/pricing.ts`) — scoped out to keep the
nav/Staff/Scheduling fix to a reasonable size, not because it's
low-value. Per-diver pricing via Diver Detail's existing Auto-Price flow
still works for every group member individually in the meantime.

### Settings > Staff: no unlinked-secretary banner on the Staff Access side

Carried over from the pre-move gap below (still unresolved, just at a
new path): `settings/staff/components/StaffFormModal.tsx` lets an owner
pick an existing secretary login to link when editing a Staff row, but
there's no reverse-direction banner on `settings/staff-access/` itself
flagging "this secretary has no staff row yet" with a one-click create,
like the live app's Access tab has.

### Send Invoice: real delivery only works to the Resend account's own email

Wired up 2026-07-26 — `sendInvoice` (`diver-form/[id]/actions.ts`, moved
from `divers/[id]/actions.ts` later the same day when `/divers` became
the new triage-tool page) now
actually sends via Resend instead of just marking the invoice sent.
Uses a **test/isolated Resend account**, deliberately separate from the
live app's already-connected one (`RESEND_API_KEY` in `.env.local`), and
Resend's shared `onboarding@resend.dev` sender since no custom domain is
verified yet.

**Real limitation, not a bug**: Resend's shared test sender can only
deliver to the Resend account's own signup email address — confirmed by
the actual Resend API error when trying to send to any other recipient.
This means invoices can't actually reach real divers' inboxes yet. To
fix: verify a domain in Resend (a subdomain of `aquadesk.online` was
the agreed plan, to avoid touching the live app's Resend/domain setup
at all — see the 2026-07-26 session write-up in `CLAUDE.md`), add the
DNS records it asks for, then update `RESEND_FROM_EMAIL` in
`.env.local` to an address on that subdomain. No code changes needed
for that part — `src/lib/email/resend.ts` already reads the from-address
from the env var.

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

### Registration: several smaller live-app behaviors not ported

Found during a 2026-07-26 audit pass against `register.html`, not fixed
in that pass (each is its own small scope decision):

- No client-side cert-card image compression — live app resizes to
  max 1600px / re-encodes JPEG q0.7 before upload; this rebuild uploads
  the raw file, so phone photos can be multi-MB.
- No "English alphabet only" filtering on name fields, no minimum-age
  check, no "can't be in the future" check on birthday/last-dive-date
  (rebuild only checks these fields are non-empty).
- Country dial code list has ~60 entries vs. the live app's ~180.
- A dead server-side mechanism: `submit_diver_registration`
  (`database/002_registration_rpcs.sql`) still supports a
  `p_payload->>'note'` key for a "last dive was 6+ months ago" reminder
  note, but `RegistrationWizard.tsx`'s payload never sets it — the
  server-side plumbing exists, nothing populates it.

### Diver Detail: no mid-visit "change experience type"

The live app lets staff switch an in-progress visit between
`fun_diving`/`dive_course` after creation (`diver-form.html`,
`openChangeExperienceModal`), gated by lock rules (bill closed/paid,
activities tied to a schedule, diver already assigned to an active
trip). `VisitPanel.tsx`/`actions.ts` only set `experienceType` once, at
visit creation — no code path to change it afterward. Found in the same
2026-07-26 audit pass; not built since it needs the same lock-rule
logic ported deliberately, not improvised.

### Settings: no Waiver/Medical Questions preview

The live app's Waiver tab has a "Preview" button for both the waiver
text and medical questions, rendering a modal showing how they'll
appear on the registration form. `WaiverEditorSection.tsx`/
`MedicalQuestionsSection.tsx` are Save-only, no preview. (The related
staff-record-reconciliation gap this entry used to also cover is now
tracked separately above, under Settings > Staff, since Staff moved
out from under a top-level nav item into Settings on 2026-07-26.)

### Login: no "remember me" or password-strength meter

Cosmetic only, found in the same audit pass. The live app's login page
has a "Remember me" checkbox (just a localStorage flag controlling
whether an existing session auto-redirects) and a live password-strength
meter on password-set forms. Neither exists in the rebuild. Trivial to
add on request — not built since neither affects functionality or
security (the real lockout/reset/suspension mechanisms all shipped
2026-07-26 independent of these).
