"use client";

import { useState, useTransition } from "react";
import { createStaffMember, updateStaffMember, type StaffFormFields } from "../actions";
import {
  POSITION_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "../constants";
import type { StaffMember, UnlinkedSecretary } from "../data";

function emptyForm(): StaffFormFields {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    whatsapp: "",
    position: "crew",
    employmentStatus: "",
    dateHired: "",
    dailyRate: "",
    nitroxCertified: false,
    linkedUserId: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    emergencyContactWhatsapp: "",
    emergencyContactEmail: "",
  };
}

function fromStaff(s: StaffMember): StaffFormFields {
  return {
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email ?? "",
    phone: s.phone ?? "",
    whatsapp: s.whatsapp ?? "",
    position: s.position,
    employmentStatus: s.employmentStatus ?? "",
    dateHired: s.dateHired ?? "",
    dailyRate: s.dailyRate === null ? "" : String(s.dailyRate),
    nitroxCertified: s.nitroxCertified,
    linkedUserId: s.userId ?? "",
    emergencyContactName: s.emergencyContactName ?? "",
    emergencyContactPhone: s.emergencyContactPhone ?? "",
    emergencyContactRelationship: s.emergencyContactRelationship ?? "",
    emergencyContactWhatsapp: s.emergencyContactWhatsapp ?? "",
    emergencyContactEmail: s.emergencyContactEmail ?? "",
  };
}

export function StaffFormModal({
  staff,
  unlinkedSecretaries,
  onClose,
}: {
  staff: StaffMember | null;
  unlinkedSecretaries: UnlinkedSecretary[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<StaffFormFields>(staff ? fromStaff(staff) : emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A secretary already linked to this staff row isn't in the unlinked
  // list (it only contains secretaries with no staff row yet) — add it
  // back in so editing doesn't silently drop the existing link.
  const secretaryOptions =
    staff?.userId && staff.position === "secretary"
      ? [{ id: staff.userId, fullName: `${staff.firstName} ${staff.lastName}`, email: staff.email ?? "" }, ...unlinkedSecretaries]
      : unlinkedSecretaries;

  function save() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = staff ? await updateStaffMember(staff.id, form) : await createStaffMember(form);
      if (res.error) {
        setError(res.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-xl text-navy">
            {staff ? "Edit Staff Member" : "Add Staff Member"}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-6 grid gap-4">
          {error && <div className="text-sm text-red">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Position</label>
              <select
                value={form.position}
                onChange={(e) =>
                  setForm({
                    ...form,
                    position: e.target.value as StaffFormFields["position"],
                    linkedUserId: e.target.value === "secretary" ? form.linkedUserId : "",
                  })
                }
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              >
                {POSITION_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employment Status</label>
              <select
                value={form.employmentStatus}
                onChange={(e) =>
                  setForm({ ...form, employmentStatus: e.target.value as StaffFormFields["employmentStatus"] })
                }
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              >
                <option value="">—</option>
                {EMPLOYMENT_STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date Hired</label>
              <input
                type="date"
                value={form.dateHired}
                onChange={(e) => setForm({ ...form, dateHired: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Daily Rate</label>
              <input
                type="number"
                min={0}
                value={form.dailyRate}
                onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.nitroxCertified}
                  onChange={(e) => setForm({ ...form, nitroxCertified: e.target.checked })}
                />
                Nitrox certified
              </label>
            </div>
          </div>

          {form.position === "secretary" && (
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Linked Secretary Login
              </label>
              <select
                value={form.linkedUserId}
                onChange={(e) => setForm({ ...form, linkedUserId: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              >
                <option value="">No login linked</option>
                {secretaryOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Linking lets this secretary see their own staff profile
                (read-only) on this page. Secretary logins themselves are
                created on Settings &gt; Staff Access.
              </p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="text-sm font-extrabold text-navy mb-3">Emergency Contact</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  value={form.emergencyContactName}
                  onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Relationship</label>
                <select
                  value={form.emergencyContactRelationship}
                  onChange={(e) => setForm({ ...form, emergencyContactRelationship: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                >
                  <option value="">—</option>
                  {RELATIONSHIP_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  value={form.emergencyContactPhone}
                  onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
                <input
                  value={form.emergencyContactWhatsapp}
                  onChange={(e) => setForm({ ...form, emergencyContactWhatsapp: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.emergencyContactEmail}
                  onChange={(e) => setForm({ ...form, emergencyContactEmail: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
