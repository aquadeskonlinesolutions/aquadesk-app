"use client";

import { useState, useRef, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveInsuranceSettings } from "./actions";

export function InsuranceSection({
  offersInsurance: initialOffers,
  referralLink: initialLink,
}: {
  offersInsurance: boolean;
  referralLink: string | null;
}) {
  const [offersInsurance, setOffersInsurance] = useState(initialOffers);
  const [referralLink, setReferralLink] = useState(initialLink ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  // Mirrored in refs (updated synchronously in the same handler that calls
  // the state setter) so Save always reads the value just clicked/typed,
  // even if Save fires before React has committed the re-render — state
  // alone would read a stale closure in that case.
  const offersInsuranceRef = useRef(offersInsurance);
  const referralLinkRef = useRef(referralLink);

  function save() {
    startTransition(async () => {
      const res = await saveInsuranceSettings(
        offersInsuranceRef.current,
        referralLinkRef.current,
      );
      if (res.error) {
        setError(res.error);
        setSuccess(false);
      } else {
        setError(null);
        setSuccess(true);
      }
    });
  }

  return (
    <SettingsSection
      title="Dive Insurance"
      subtitle="Referral link shown to divers during registration who don't have dive insurance"
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}
      {success && <div className="mb-3 text-sm text-green">Saved.</div>}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Do you offer dive insurance?
        </label>
        <div className="inline-flex border border-gray-200 rounded-md overflow-hidden">
          {[
            { label: "Yes", value: true },
            { label: "No", value: false },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => {
                offersInsuranceRef.current = opt.value;
                setOffersInsurance(opt.value);
                setSuccess(false);
              }}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                offersInsurance === opt.value
                  ? "bg-navy text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {offersInsurance && (
        <div className="mb-4 max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Referral link
          </label>
          <input
            type="url"
            value={referralLink}
            onChange={(e) => {
              referralLinkRef.current = e.target.value;
              setReferralLink(e.target.value);
              setSuccess(false);
            }}
            placeholder="https://..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      <button
        onClick={save}
        disabled={pending}
        className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </SettingsSection>
  );
}
