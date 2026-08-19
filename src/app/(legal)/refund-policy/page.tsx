import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy · AquaDesk",
};

export default function RefundPolicyPage() {
  return (
    <article>
      <h1 className="font-display text-3xl text-navy mb-2">Refund Policy</h1>
      <p className="text-sm text-gray-400 mb-10">Effective August 19, 2026</p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">No Refunds</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        All AquaDesk payments are non-refundable. We don&rsquo;t issue refunds or credits for
        unused days within a paid billing period, regardless of the reason for cancellation or
        early termination.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">Cancelling Your Subscription</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        You can cancel any time from Settings &gt; Subscription — no formal written notice
        required. Cancellation takes effect at the end of your current paid billing period, and
        you keep access until then. No refund is issued for any unused portion of that period.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">Failed or Missed Payments</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        If an automatic card payment fails, access is suspended immediately; Paddle (our payment
        processor) retries automatically over the following days, and access is restored the
        moment a retry succeeds. For manual billing arrangements, a five (5) day grace period
        applies from the due date before the account is paused. If payment remains outstanding
        after the grace period, the account may be terminated.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">
        Reactivating a Paused or Terminated Account
      </h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        A paused or terminated account can be reactivated subject to a ₱1,000 reactivation fee,
        one month&rsquo;s advance payment, and settlement of any outstanding balance. We may
        decline reactivation at our discretion.
      </p>

      <h2 className="font-display text-lg text-navy mt-10 mb-3">Questions</h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">
        If you believe you were charged in error, contact us at aquadeskonline@gmail.com and
        we&rsquo;ll look into it.
      </p>
    </article>
  );
}
