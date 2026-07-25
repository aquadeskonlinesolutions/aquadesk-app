"use client";

import { Fragment, useState, useTransition } from "react";
import type {
  StaffMember,
  StaffCertification,
  UnlinkedSecretary,
} from "./data";
import { POSITION_LABELS, EMPLOYMENT_STATUS_LABELS } from "./constants";
import { toggleStaffActive, deleteStaffMember } from "./actions";
import { StaffFormModal } from "./components/StaffFormModal";
import { CertificationsSection } from "./components/CertificationsSection";
import { CrewCodeSection } from "./components/CrewCodeSection";

export function StaffClient({
  diveCenterId,
  isOwner,
  roster,
  certifications,
  unlinkedSecretaries,
  crewTokenToday,
}: {
  diveCenterId: string;
  isOwner: boolean;
  roster: StaffMember[];
  certifications: StaffCertification[];
  unlinkedSecretaries: UnlinkedSecretary[];
  crewTokenToday: string | null;
}) {
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleActive(staffId: string, isActive: boolean) {
    startTransition(async () => {
      const res = await toggleStaffActive(staffId, isActive);
      if (res.error) setError(res.error);
    });
  }

  function remove(staffId: string, name: string) {
    if (!window.confirm(`Remove ${name} from the staff roster? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteStaffMember(staffId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-navy mb-1">Staff</h1>
          <p className="text-gray-600 text-sm">
            {isOwner
              ? "Manage your dive center's staff roster, roles, and positions."
              : "Your staff profile."}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setEditing("new")}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors"
          >
            + Add Staff Member
          </button>
        )}
      </div>

      <CrewCodeSection diveCenterId={diveCenterId} crewTokenToday={crewTokenToday} />

      {error && <div className="text-sm text-red">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
        {roster.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {isOwner
              ? "No staff members yet."
              : "No staff profile is linked to your account yet — ask your dive center owner to link one."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Position</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Employment</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Contact</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Nitrox</th>
                {isOwner && (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Active</th>
                )}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => {
                const certs = certifications.filter((c) => c.staffId === s.id);
                const expanded = expandedId === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr className="border-b border-gray-100 last:border-0 hover:bg-off-white">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-navy">
                          {s.firstName} {s.lastName}
                        </div>
                        {!s.isActive && <div className="text-xs text-red">Inactive</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{POSITION_LABELS[s.position]}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.employmentStatus ? EMPLOYMENT_STATUS_LABELS[s.employmentStatus] : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.email || s.whatsapp || s.phone || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{s.nitroxCertified ? "Yes" : "—"}</td>
                      {isOwner && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={s.isActive}
                            disabled={pending}
                            onChange={(e) => toggleActive(s.id, e.target.checked)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setExpandedId(expanded ? null : s.id)}
                            className="px-3 py-1.5 text-xs font-medium text-navy border border-gray-300 rounded-md hover:bg-gray-100"
                          >
                            {expanded ? "Hide Certs" : `Certs (${certs.length})`}
                          </button>
                          {isOwner && (
                            <>
                              <button
                                onClick={() => setEditing(s)}
                                className="px-3 py-1.5 text-xs font-medium text-navy border border-gray-300 rounded-md hover:bg-gray-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => remove(s.id, `${s.firstName} ${s.lastName}`)}
                                disabled={pending}
                                className="px-3 py-1.5 text-xs font-medium text-red border border-red/30 rounded-md hover:bg-red/5"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-gray-100 last:border-0 bg-off-white">
                        <td colSpan={isOwner ? 7 : 6} className="px-4 py-4">
                          <CertificationsSection
                            staffId={s.id}
                            certifications={certs}
                            isOwner={isOwner}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <StaffFormModal
          staff={editing === "new" ? null : editing}
          unlinkedSecretaries={unlinkedSecretaries}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
