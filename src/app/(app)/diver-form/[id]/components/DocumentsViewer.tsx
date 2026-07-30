"use client";

import { useState } from "react";
import type { DiverDetail, RegistrationRecord } from "../data";
import { CERT_LEVEL_LABELS } from "../constants";

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

// Registrations from before migration 017 have no identity snapshot of
// their own — fall back to the diver's current profile for those only, so
// old records don't show blank. Anything signed after the migration
// always reads its own frozen fields, never the live diver record, so a
// later name correction can't retroactively change what an old signed
// document appears to say.
function resolveIdentity(selected: RegistrationRecord, diver: DiverDetail) {
  return {
    firstName: selected.firstName ?? diver.firstName,
    lastName: selected.lastName ?? diver.lastName,
    birthday: selected.birthday ?? diver.birthday,
    nationality: selected.nationality ?? diver.nationality,
    email: selected.email ?? diver.email,
    phone: selected.phone ?? diver.phone,
    whatsapp: selected.whatsapp ?? diver.whatsapp,
  };
}

export function DocumentsViewer({
  registrations,
  diver,
}: {
  registrations: RegistrationRecord[];
  diver: DiverDetail;
}) {
  const [selectedId, setSelectedId] = useState(registrations[0]?.id ?? null);

  if (registrations.length === 0) {
    return (
      <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-sm text-gray-400">
        No registration record on file for this diver.
      </div>
    );
  }

  const selected = registrations.find((r) => r.id === selectedId) ?? registrations[0];
  const identity = resolveIdentity(selected, diver);
  const yesAnswers = selected.medicalAnswersSnapshot.filter((a) => a.answer === true || a.answer === "yes");

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 flex-wrap print:hidden">
        <div>
          <div className="text-sm font-extrabold text-navy">Signed Documents</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Every registration event for this diver — read-only, exactly as signed.
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 bg-white border border-gray-300 text-navy text-xs font-medium rounded-md hover:bg-gray-50"
        >
          🖨 Print
        </button>
      </div>

      {registrations.length > 1 && (
        <div className="px-5 py-3 border-b border-gray-200 flex gap-2 flex-wrap print:hidden">
          {registrations.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                selected.id === r.id ? "bg-navy text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {fmtDateTime(r.createdAt)}
            </button>
          ))}
        </div>
      )}

      <div className="print:hidden p-5 grid gap-4">
        <div className="border border-gray-200 rounded-lg p-3 bg-off-white">
          <div className="text-sm font-extrabold text-navy">
            {identity.firstName} {identity.lastName}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {identity.nationality || "Nationality not on file"}
            {identity.birthday ? ` · Born ${fmtDate(identity.birthday)}` : ""}
            {identity.email ? ` · ${identity.email}` : ""}
            {identity.phone ? ` · ${identity.phone}` : ""}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Arrival</div>
            <div className="text-sm font-semibold text-navy">{fmtDate(selected.arrivalDate)}</div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Departure</div>
            <div className="text-sm font-semibold text-navy">{fmtDate(selected.departureDate)}</div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Accommodation</div>
            <div className="text-sm font-semibold text-navy">{selected.accommodation || "—"}</div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Certification</div>
            <div className="text-sm font-semibold text-navy">
              {(selected.certificationLevel && CERT_LEVEL_LABELS[selected.certificationLevel]) ||
                selected.certificationLevel ||
                "—"}
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-1">Medical Declaration</div>
          {selected.medicalFlag ? (
            yesAnswers.length > 0 ? (
              <ul className="text-sm text-gray-700 list-disc pl-5">
                {yesAnswers.map((a, i) => (
                  <li key={i}>{a.question_text}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">Flagged, no answer detail on file.</div>
            )
          ) : (
            <div className="text-sm text-gray-500">No medical concerns declared.</div>
          )}
        </div>

        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-1">Privacy Consent</div>
          <div className="text-sm text-gray-500">
            {selected.privacyConsentAt ? `Consented ${fmtDateTime(selected.privacyConsentAt)}` : "Not on file."}
          </div>
        </div>

        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-1">
            Waiver {selected.waiverSigned ? `— signed ${fmtDateTime(selected.waiverDate)}` : "— not signed"}
          </div>
          {selected.waiverContentSnapshot && (
            <details className="text-xs text-gray-600 border border-gray-200 rounded-lg">
              <summary className="cursor-pointer select-none px-3 py-2 font-medium text-navy">
                View full waiver text
              </summary>
              <div
                className="p-3 pt-0 prose prose-sm"
                dangerouslySetInnerHTML={{ __html: selected.waiverContentSnapshot }}
              />
            </details>
          )}
          {selected.waiverSignatureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.waiverSignatureUrl}
              alt="Signature"
              className="mt-2 max-h-24 border border-gray-200 rounded-lg bg-off-white"
            />
          )}
        </div>
      </div>

      {/* Print-only view — everything in full, unlike the condensed on-screen
          version above: every medical question with its answer (not just
          the flagged ones), the full waiver text with no scroll clipping,
          and the signature. */}
      <div className="hidden print:block p-6">
        <div className="text-lg font-extrabold text-navy mb-1">
          {identity.firstName} {identity.lastName}
        </div>
        <div className="text-sm text-gray-600 mb-4">
          {identity.nationality || "Nationality not on file"}
          {identity.birthday ? ` · Born ${fmtDate(identity.birthday)}` : ""}
          {identity.email ? ` · ${identity.email}` : ""}
          {identity.phone ? ` · ${identity.phone}` : ""}
          {identity.whatsapp ? ` · WhatsApp ${identity.whatsapp}` : ""}
          {" · Signed "}
          {fmtDateTime(selected.createdAt)}
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Arrival</div>
            <div className="text-sm font-semibold text-navy">{fmtDate(selected.arrivalDate)}</div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Departure</div>
            <div className="text-sm font-semibold text-navy">{fmtDate(selected.departureDate)}</div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Accommodation</div>
            <div className="text-sm font-semibold text-navy">{selected.accommodation || "—"}</div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">Certification</div>
            <div className="text-sm font-semibold text-navy">
              {(selected.certificationLevel && CERT_LEVEL_LABELS[selected.certificationLevel]) ||
                selected.certificationLevel ||
                "—"}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-1">
            Medical Declaration
          </div>
          {selected.medicalAnswersSnapshot.length > 0 ? (
            <ul className="text-sm text-gray-700 pl-0" style={{ listStyle: "none" }}>
              {selected.medicalAnswersSnapshot.map((a, i) => (
                <li key={i}>
                  {a.question_text} — <strong>{a.answer === true || a.answer === "yes" ? "Yes" : "No"}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500">No medical questionnaire on file.</div>
          )}
        </div>

        <div className="mb-4">
          <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-1">Privacy Consent</div>
          <div className="text-sm text-gray-700">
            {selected.privacyConsentAt ? `Consented ${fmtDateTime(selected.privacyConsentAt)}` : "Not on file."}
          </div>
        </div>

        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-1">
            Waiver {selected.waiverSigned ? `— signed ${fmtDateTime(selected.waiverDate)}` : "— not signed"}
          </div>
          {selected.waiverContentSnapshot && (
            <div
              className="text-sm text-gray-700 prose prose-sm"
              dangerouslySetInnerHTML={{ __html: selected.waiverContentSnapshot }}
            />
          )}
          {selected.waiverSignatureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.waiverSignatureUrl} alt="Signature" className="mt-2 max-h-24" />
          )}
        </div>
      </div>
    </div>
  );
}
