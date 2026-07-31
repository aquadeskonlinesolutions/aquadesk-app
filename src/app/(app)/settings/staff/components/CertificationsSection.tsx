"use client";

import { useState, useTransition } from "react";
import { addCertification, deleteCertification } from "../actions";
import type { StaffCertification } from "../data";

function expiryBadge(expiryDate: string | null): { label: string; className: string } | null {
  if (!expiryDate) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const days = (new Date(expiryDate).getTime() - new Date(today).getTime()) / 86_400_000;
  if (days < 0) return { label: "Expired", className: "bg-red-light text-red" };
  if (days <= 30) return { label: "Expires soon", className: "bg-orange-light text-orange" };
  return null;
}

// Settings > Staff is owner-only at the layout level, so unlike the old
// top-level Staff page this never needs an isOwner prop — every caller
// here can add/remove certifications.
export function CertificationsSection({
  staffId,
  certifications,
}: {
  staffId: string;
  certifications: StaffCertification[];
}) {
  const [certName, setCertName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!certName.trim()) {
      setError("Certification name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addCertification(staffId, certName, expiryDate);
      if (res.error) {
        setError(res.error);
      } else {
        setCertName("");
        setExpiryDate("");
      }
    });
  }

  function remove(certId: string) {
    startTransition(async () => {
      const res = await deleteCertification(certId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="grid gap-3">
      {error && <div className="text-sm text-red">{error}</div>}

      {certifications.length === 0 ? (
        <div className="text-sm text-gray-400">No certifications on file.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {certifications.map((c) => {
            const badge = expiryBadge(c.expiryDate);
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <div className="font-medium text-navy flex-1">{c.certName}</div>
                <div className="text-gray-600">{c.expiryDate ? `Expires ${c.expiryDate}` : "No expiry"}</div>
                {badge && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                <button onClick={() => remove(c.id)} disabled={pending} className="text-xs text-red hover:underline">
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Certification Name</label>
          <input
            value={certName}
            onChange={(e) => setCertName(e.target.value)}
            placeholder="e.g. PADI Divemaster"
            className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={add}
          disabled={pending}
          className="px-3 py-1.5 bg-teal text-white text-xs font-medium rounded-md hover:bg-teal-mid disabled:opacity-60"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
