"use client";

import { useState, useTransition } from "react";
import { saveDiverProfile, type ProfileFormFields } from "../actions";
import { CERT_LEVEL_OPTIONS, RELATIONSHIP_OPTIONS } from "../constants";
import type { DiverDetail } from "../data";

export function EditProfileModal({
  diver,
  onClose,
  onSaved,
}: {
  diver: DiverDetail;
  onClose: () => void;
  onSaved: (d: DiverDetail) => void;
}) {
  const [form, setForm] = useState<ProfileFormFields>({
    firstName: diver.firstName,
    lastName: diver.lastName,
    certificationLevel: diver.certificationLevel,
    loggedDives: diver.loggedDives,
    lastDiveDate: diver.lastDiveDate ?? "",
    nitroxCertified: diver.nitroxCertified,
    email: diver.email ?? "",
    whatsapp: diver.whatsapp ?? "",
    accommodation: diver.accommodation ?? "",
    foodAllergies: diver.foodAllergies ?? "",
    hasDiveInsurance: diver.hasDiveInsurance,
    insuranceProvider: diver.insuranceProvider ?? "",
    insurancePolicyNumber: diver.insurancePolicyNumber ?? "",
    emergencyContactName: diver.emergencyContactName ?? "",
    emergencyContactPhone: diver.emergencyContactPhone ?? "",
    emergencyContactRelationship: diver.emergencyContactRelationship ?? "",
    emergencyContactWhatsapp: diver.emergencyContactWhatsapp ?? "",
    emergencyContactEmail: diver.emergencyContactEmail ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    // Matches the registration wizard's own conditional requirement
    // (RegistrationWizard.tsx): a diver with any real certification level
    // must have logged dives and a last dive date on file — a "None"
    // cert diver (first-timer) is exempt from both.
    if (form.certificationLevel !== "none" && !form.lastDiveDate) {
      setError("Last dive date is required for certified divers.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveDiverProfile(diver.id, form);
      if (res.error) {
        setError(res.error);
      } else {
        onSaved({
          ...diver,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          certificationLevel: form.certificationLevel,
          loggedDives: form.loggedDives,
          lastDiveDate: form.lastDiveDate || null,
          nitroxCertified: form.nitroxCertified,
          email: form.email.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          accommodation: form.accommodation.trim() || null,
          foodAllergies: form.foodAllergies.trim() || null,
          hasDiveInsurance: form.hasDiveInsurance,
          insuranceProvider: form.hasDiveInsurance ? form.insuranceProvider.trim() || null : null,
          insurancePolicyNumber: form.hasDiveInsurance ? form.insurancePolicyNumber.trim() || null : null,
          emergencyContactName: form.emergencyContactName.trim() || null,
          emergencyContactPhone: form.emergencyContactPhone.trim() || null,
          emergencyContactRelationship: form.emergencyContactRelationship.trim() || null,
          emergencyContactWhatsapp: form.emergencyContactWhatsapp.trim() || null,
          emergencyContactEmail: form.emergencyContactEmail.trim() || null,
        });
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-xl text-navy">Edit Diver Info</div>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Certification Level</label>
              <select
                value={form.certificationLevel}
                onChange={(e) => setForm({ ...form, certificationLevel: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              >
                {CERT_LEVEL_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Logged Dives</label>
              <input
                type="number"
                onFocus={(e) => e.currentTarget.select()}
                min={0}
                value={form.loggedDives}
                onChange={(e) => setForm({ ...form, loggedDives: parseInt(e.target.value, 10) || 0 })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Last Dive Date{form.certificationLevel !== "none" ? " *" : ""}
              </label>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.lastDiveDate}
                onChange={(e) => setForm({ ...form, lastDiveDate: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
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
              <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.nitroxCertified}
                  onChange={(e) => setForm({ ...form, nitroxCertified: e.target.checked })}
                />
                Nitrox certified
              </label>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Accommodation</label>
              <input
                value={form.accommodation}
                onChange={(e) => setForm({ ...form, accommodation: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Food Allergies</label>
              <input
                value={form.foodAllergies}
                onChange={(e) => setForm({ ...form, foodAllergies: e.target.value })}
                placeholder="Leave blank if none"
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>

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

          <div className="border-t border-gray-200 pt-4">
            <div className="text-sm font-extrabold text-navy mb-3">Dive Insurance</div>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, hasDiveInsurance: true })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${form.hasDiveInsurance === true ? "bg-navy text-white" : "bg-gray-100 text-gray-600"}`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, hasDiveInsurance: false })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${form.hasDiveInsurance === false ? "bg-navy text-white" : "bg-gray-100 text-gray-600"}`}
              >
                No
              </button>
            </div>
            {form.hasDiveInsurance === true && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
                  <input
                    value={form.insuranceProvider}
                    onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Policy Number</label>
                  <input
                    value={form.insurancePolicyNumber}
                    onChange={(e) => setForm({ ...form, insurancePolicyNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>
            )}
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
            {pending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
