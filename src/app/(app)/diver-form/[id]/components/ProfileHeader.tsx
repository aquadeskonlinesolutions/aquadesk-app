"use client";

import { CERT_LEVEL_LABELS } from "../constants";
import type { DiverDetail } from "../data";

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-extrabold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-navy">{value || "—"}</div>
    </div>
  );
}

function equipmentSummary(diver: DiverDetail): string {
  if (!diver.needsEquipment) return "Has own gear";
  try {
    const parsed = diver.equipmentRequested ? JSON.parse(diver.equipmentRequested) : null;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const count = items.length + (parsed?.computer ? 1 : 0);
    return count > 0 ? `${count} item${count === 1 ? "" : "s"} requested` : "Needs equipment (none selected yet)";
  } catch {
    return "Needs equipment";
  }
}

export function ProfileHeader({
  diver,
  onEditClick,
  onCertCardClick,
  onEquipmentClick,
}: {
  diver: DiverDetail;
  onEditClick: () => void;
  onCertCardClick: () => void;
  onEquipmentClick: () => void;
}) {
  return (
    <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="font-display text-2xl text-navy">
            {diver.firstName} {diver.lastName}
            {diver.traceNumber && (
              <span className="ml-2 align-middle text-xs font-normal text-gray-400">{diver.traceNumber}</span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {CERT_LEVEL_LABELS[diver.certificationLevel] ?? diver.certificationLevel}
            {diver.groupName ? ` · ${diver.groupName}` : ""}
          </div>
        </div>
        <div className="flex gap-2">
          {diver.certCardUrl && (
            <button
              onClick={onCertCardClick}
              className="px-3 py-1.5 bg-white border border-gray-300 text-navy text-xs font-medium rounded-md hover:bg-gray-50"
            >
              View Cert Card
            </button>
          )}
          <button
            onClick={onEquipmentClick}
            className="px-3 py-1.5 bg-white border border-gray-300 text-navy text-xs font-medium rounded-md hover:bg-gray-50"
          >
            Equipment
          </button>
          <button
            onClick={onEditClick}
            className="px-3 py-1.5 bg-navy text-white text-xs font-medium rounded-md hover:bg-navy-dark"
          >
            Edit Diver Info
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Equipment" value={equipmentSummary(diver)} />
        <Field label="Nationality" value={diver.nationality ?? ""} />
        <Field label="Logged Dives" value={String(diver.loggedDives)} />
        <Field label="Last Dive Date" value={fmtDate(diver.lastDiveDate)} />
        <Field label="Nitrox Certified" value={diver.nitroxCertified ? "Yes" : "No"} />
        <Field label="WhatsApp" value={diver.whatsapp ?? ""} />
        <Field label="Email" value={diver.email ?? ""} />
        <Field label="Accommodation" value={diver.accommodation ?? ""} />
        <Field label="Arrival" value={fmtDate(diver.latestArrivalDate)} />
        <Field label="Departure" value={fmtDate(diver.latestDepartureDate)} />
        <Field label="Food Allergies" value={diver.foodAllergies ?? "None noted"} />
        <Field
          label="Dive Insurance"
          value={
            diver.hasDiveInsurance === null
              ? "—"
              : diver.hasDiveInsurance
                ? `Yes${diver.insuranceProvider ? ` · ${diver.insuranceProvider}` : ""}`
                : "No"
          }
        />
        <Field
          label="Emergency Contact"
          value={
            diver.emergencyContactName
              ? `${diver.emergencyContactName}${diver.emergencyContactRelationship ? ` (${diver.emergencyContactRelationship})` : ""}`
              : ""
          }
        />
        <Field label="Emergency Phone" value={diver.emergencyContactPhone ?? ""} />
      </div>
    </div>
  );
}
