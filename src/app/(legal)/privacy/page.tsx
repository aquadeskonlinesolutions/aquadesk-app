import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · AquaDesk",
};

export default function PrivacyPolicyPage() {
  return (
    <article>
      <h1 className="font-display text-3xl text-navy mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-10">Effective August 19, 2026</p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">1. What We Collect</h2>
      <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed mb-4 space-y-2">
        <li>
          <span className="font-semibold text-dark">Diver data</span> — name, contact details,
          certification level, emergency contacts, and digital waiver signatures, submitted via
          registration links you send divers.
        </li>
        <li>
          <span className="font-semibold text-dark">Dive center operational data</span> —
          bookings, activity logs, boat manifests, staff records, and billing/invoice history.
        </li>
        <li>
          <span className="font-semibold text-dark">Account data</span> — owner and secretary
          names, email addresses, and login credentials.
        </li>
        <li>
          <span className="font-semibold text-dark">Payment data</span> — subscription payments
          are processed by Paddle, our payment processor. We don&rsquo;t collect or store your
          card details — Paddle handles them directly and shares with us only what&rsquo;s needed
          to manage your subscription (status, plan, billing history).
        </li>
      </ul>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">2. How We Use It</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        Data is used solely to operate AquaDesk for your dive center: diver registration and
        scheduling, billing and invoicing, staff/commission management, reporting, and
        account/subscription management. We don&rsquo;t sell diver or dive-center data, and
        don&rsquo;t use it for advertising.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">3. Third-Party Processors</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        AquaDesk relies on the following providers to operate:
      </p>
      <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed mb-4 space-y-2">
        <li>
          <span className="font-semibold text-dark">Supabase</span> — database hosting and
          authentication
        </li>
        <li>
          <span className="font-semibold text-dark">Paddle</span> — subscription billing and
          payment processing
        </li>
        <li>
          <span className="font-semibold text-dark">Cloudflare</span> — application hosting and
          content delivery
        </li>
        <li>
          <span className="font-semibold text-dark">Resend</span> — transactional email delivery
        </li>
      </ul>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        Each processes data only as needed to provide their respective service to us.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">4. Data Retention</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        Operational data is retained for as long as your account is active. Following
        termination, data is retained for thirty (30) days, after which it&rsquo;s permanently
        deleted. You may request a data export before or during that 30-day window (export fees
        are tiered by diver record count — see your Service Agreement for details).
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">5. Your Rights</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        You may request access to, correction of, or deletion of personal data we hold, subject
        to our data retention terms above. Contact aquadeskonline@gmail.com to make a request.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">6. Security</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        We rely on our infrastructure providers&rsquo; security controls (encryption in transit
        and at rest, access controls) to protect data. Account holders are responsible for
        keeping their own login credentials confidential.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">7. Changes to This Policy</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        We may update this Privacy Policy from time to time. Material changes will be
        communicated with reasonable notice.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">8. Contact</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        Questions about this Privacy Policy: aquadeskonline@gmail.com
      </p>
    </article>
  );
}
