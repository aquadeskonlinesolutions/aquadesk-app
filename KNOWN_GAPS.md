# Known Gaps

Tracks anything intentionally left incomplete while building a page, so it
doesn't get lost in chat history. Default is to finish each page fully
before moving on — an entry here means there was a real reason it couldn't
be (usually: needs a decision only the client can make, or depends on
infrastructure not built yet).

Format per entry: page/feature, what's missing, why, what finishing it
would require. Remove the entry once it's resolved.

## Open

### Send Invoice: real delivery only works to the Resend account's own email

Wired up 2026-07-26 — `sendInvoice` (`divers/[id]/actions.ts`) now
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

### Settings: no Waiver/Medical Questions preview, no staff-record reconciliation

Two separate Settings gaps found in the same audit pass:

- The live app's Waiver tab has a "Preview" button for both the waiver
  text and medical questions, rendering a modal showing how they'll
  appear on the registration form. `WaiverEditorSection.tsx`/
  `MedicalQuestionsSection.tsx` are Save-only, no preview.
- The live app's Access tab reconciles a `staff` row (position =
  Secretary) with no linked login — shows a "no login account linked
  yet" banner and a one-click "Create Login," and keeps `staff.is_active`
  in sync when `users.is_active` is toggled. This rebuild's
  `SecretaryAccountsSection`/`staff-access/actions.ts` only reads/writes
  `users` rows — no handling of an unlinked `staff` row, and toggling
  active status doesn't touch a linked `staff` row (the Staff page
  handles the *reverse* linking direction instead).

### Login: no "remember me" or password-strength meter

Cosmetic only, found in the same audit pass. The live app's login page
has a "Remember me" checkbox (just a localStorage flag controlling
whether an existing session auto-redirects) and a live password-strength
meter on password-set forms. Neither exists in the rebuild. Trivial to
add on request — not built since neither affects functionality or
security (the real lockout/reset/suspension mechanisms all shipped
2026-07-26 independent of these).
