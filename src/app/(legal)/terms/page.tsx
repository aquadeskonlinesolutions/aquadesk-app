import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · AquaDesk",
};

export default function TermsPage() {
  return (
    <article>
      <h1 className="font-display text-3xl text-navy mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-10">Effective August 19, 2026</p>

      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of AquaDesk, a
        dive-center operations management platform operated by its owner (&ldquo;AquaDesk&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;), accessible at aquadesk.online. By creating an account or
        using AquaDesk, the dive center owner or authorized representative (&ldquo;Client&rdquo;,
        &ldquo;you&rdquo;) agrees to be bound by these Terms.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">1. Service Description</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        AquaDesk provides digital diver registration and waiver collection, daily scheduling and
        trip management, billing and invoicing, staff and commission management, boat manifest
        generation, reporting and analytics, and owner/secretary account access.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">2. Subscription and Payment</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        Subscriptions are billed monthly or annually at the price shown at checkout. Payment is
        due in advance of each billing period; access is granted on confirmation of payment.
      </p>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        For card-based subscriptions billed automatically, a failed payment suspends account
        access immediately; our payment processor, Paddle, retries automatically over the
        following days, and access is restored the moment a retry succeeds. Accounts on manual
        billing arrangements get a five (5) day grace period from the due date before being
        paused.
      </p>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        See our <Link href="/refund-policy" className="text-teal-mid hover:underline">Refund Policy</Link> for
        cancellation and refund terms. We may adjust subscription pricing with at least thirty
        (30) days&rsquo; notice; changes apply to future billing periods only.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">3. Service Availability</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        We make reasonable efforts to keep AquaDesk available. AquaDesk relies on third-party
        infrastructure (including Supabase, Cloudflare, and Resend); interruptions caused by
        these providers are outside our direct control. We are not liable for operational losses,
        missed revenue, or business disruption from downtime or technical issues.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">4. Termination and Suspension</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        If payment isn&rsquo;t received within the grace period, the account is automatically
        paused and may be terminated if the balance stays outstanding.
      </p>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        You may cancel at any time from Settings &gt; Subscription. Cancellation takes effect at
        the end of the current paid billing period — see our{" "}
        <Link href="/refund-policy" className="text-teal-mid hover:underline">Refund Policy</Link> for
        details.
      </p>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        We may terminate and suspend access immediately for violation of these Terms, including
        misuse of the platform or unauthorized sharing of access credentials.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">5. Data Ownership and Privacy</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        All operational data you enter remains your property. See our{" "}
        <Link href="/privacy" className="text-teal-mid hover:underline">Privacy Policy</Link> for
        how we collect, use, and retain data, including what happens after termination.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">6. Confidentiality</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        We keep Client data confidential and will not share, sell, or disclose it except as
        required by law or to operate the service via our bound third-party providers.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">7. Account Security</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        You&rsquo;re responsible for keeping your login credentials confidential. We are not
        liable for unauthorized access resulting from a failure to secure credentials.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">8. Limitation of Liability</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        Our total liability shall not exceed the amount you paid in the one (1) month preceding
        the claim. We are not liable for indirect, incidental, or consequential damages.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">9. Governing Law</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        These Terms are governed by the laws of the Republic of the Philippines.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">10. Amendments</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        We may update these Terms, with at least thirty (30) days&rsquo; notice for material
        changes. Continued use after the effective date constitutes acceptance.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">11. Contact</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        Questions about these Terms: aquadeskonline@gmail.com
      </p>
    </article>
  );
}
