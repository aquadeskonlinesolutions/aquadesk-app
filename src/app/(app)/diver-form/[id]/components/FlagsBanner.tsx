"use client";

import { useState, useTransition } from "react";
import { acknowledgeMedical } from "../actions";
import type { DiverDetail } from "../data";

function fmtDateTime(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function FlagsBanner({ diver, onUpdated }: { diver: DiverDetail; onUpdated: (d: DiverDetail) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const showMinorBanner = diver.isMinor;
  const showMedicalBanner = diver.medicalFlag && !diver.medicalAcknowledgedAt;
  const yesAnswers = diver.medicalAnswersSnapshot.filter((a) => a.answer === true || a.answer === "yes");

  function acknowledge() {
    setError(null);
    startTransition(async () => {
      const res = await acknowledgeMedical(diver.id);
      if (res.error) {
        setError(res.error);
      } else {
        onUpdated({ ...diver, medicalAcknowledgedAt: new Date().toISOString() });
      }
    });
  }

  if (!showMinorBanner && !showMedicalBanner && !diver.medicalAcknowledgedAt) return null;

  return (
    <div className="grid gap-2">
      {showMinorBanner && (
        <div className="bg-orange-light text-orange text-sm font-medium rounded-xl px-4 py-3">
          👶 This diver is a minor (under 18). Additional documents may be required.
        </div>
      )}
      {showMedicalBanner && (
        <div className="bg-red-light text-red rounded-xl px-4 py-3">
          <div className="text-sm font-medium mb-1">
            ⚠️ Medical questionnaire flagged {yesAnswers.length > 0 ? "— " : ""}
            {yesAnswers.map((a) => a.question_text).join(", ")}
          </div>
          {error && <div className="text-xs mb-2">{error}</div>}
          <button
            onClick={acknowledge}
            disabled={pending}
            className="px-3 py-1.5 bg-red text-white text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Acknowledging…" : "Acknowledge"}
          </button>
        </div>
      )}
      {!showMedicalBanner && diver.medicalFlag && diver.medicalAcknowledgedAt && (
        <div className="text-xs text-gray-400">
          Medical flag acknowledged {fmtDateTime(diver.medicalAcknowledgedAt)}.
        </div>
      )}
    </div>
  );
}
