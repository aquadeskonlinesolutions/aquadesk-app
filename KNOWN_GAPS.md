# Known Gaps

Tracks anything intentionally left incomplete while building a page, so it
doesn't get lost in chat history. Default is to finish each page fully
before moving on — an entry here means there was a real reason it couldn't
be (usually: needs a decision only the client can make, or depends on
infrastructure not built yet).

Format per entry: page/feature, what's missing, why, what finishing it
would require. Remove the entry once it's resolved.

## Open

### Dashboard: two old alert types not reproduced

The live app's Dashboard had 6 alert checks; this rebuild's Dashboard
(`src/app/(app)/dashboard/data.ts`) has 4. Two are skipped because the
data they depend on doesn't exist in the new schema yet — both are really
Scheduling/Reports features, not Dashboard ones, so they should be
revisited once those pages define how the underlying data gets captured.

1. **"Government fees not logged today."** The live app checked a daily
   `govt_fees` log (rows with a `date`, meaning "fees collected today").
   The new schema's `govt_fees` table is a **rate/config table** only
   (`fee_name`, `amount`, `is_active` — no `date` column), grouped with
   `course_rates`/`equipment_rental_rates` under "Pricing & rates." There
   is no table anywhere that records a daily log of government fees
   actually collected. Building one is a Reports-page decision (that's
   where the log entry would be made), not something to bolt on for one
   Dashboard alert.

2. **"Another boat joined us today, not yet logged."** The live app
   detected this by parsing a JSON blob in `schedules.notes`
   (`joinerDivers`/`joinerDC` keys) set at schedule-creation time. The new
   schema replaced that notes-JSON pattern with explicit columns
   (`schedules.is_joiner`, `schedules.joiner_boat_name`) — but only for
   the "we joined someone else's boat" direction. There's no equivalent
   signal captured anywhere for the reverse direction (another dive
   center's divers joining our boat) until Scheduling is built and defines
   how that gets entered.

Both are commented in `data.ts` above `loadAlerts()`. Revisit when
Scheduling/Reports are built — don't guess a workaround before then.

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
