"use client";

import { useState, useTransition } from "react";
import { SettingsSection, InfoBox } from "@/components/settings/SettingsSection";
import {
  createSecretary,
  resetSecretaryPassword,
  toggleSecretaryActive,
  toggleRevenueVisibility,
} from "./actions";
import type { SecretaryAccount } from "./data";

export function SecretaryAccountsSection({
  secretaries,
}: {
  secretaries: SecretaryAccount[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<{ label: string; value: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const res = await createSecretary(name, email);
      if (res.error !== undefined) {
        setError(res.error);
        setTempPassword(null);
      } else {
        setError(null);
        setTempPassword({ label: `${name} — temporary password`, value: res.tempPassword });
        setName("");
        setEmail("");
      }
    });
  }

  function resetPassword(id: string, accountName: string) {
    startTransition(async () => {
      const res = await resetSecretaryPassword(id);
      if (res.error !== undefined) setError(res.error);
      else {
        setError(null);
        setTempPassword({ label: `${accountName} — new temporary password`, value: res.tempPassword });
      }
    });
  }

  function toggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      const res = await toggleSecretaryActive(id, isActive);
      if (res.error) setError(res.error);
    });
  }

  function toggleRevenue(id: string, canView: boolean) {
    startTransition(async () => {
      const res = await toggleRevenueVisibility(id, canView);
      if (res.error) setError(res.error);
    });
  }

  return (
    <>
      <SettingsSection
        title="Create Secretary Account"
        subtitle="Add a new secretary login"
      >
        <InfoBox>
          🔐 Secretary accounts are managed here only. Divemasters and
          instructors are added on the Staff page — they don&apos;t get
          system access.
        </InfoBox>
        {error && <div className="mb-3 text-sm text-red">{error}</div>}
        {tempPassword && (
          <div className="mb-4 rounded-lg bg-green-light border border-green/30 p-4 text-sm">
            <p className="font-medium text-green mb-1">{tempPassword.label}:</p>
            <code className="block font-mono text-sm bg-white border border-gray-200 rounded px-2 py-1 break-all">
              {tempPassword.value}
            </code>
            <p className="text-gray-600 mt-1.5">
              Shown once — give this to them. They&apos;ll be forced to set a
              real password on first login.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Full Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={create}
            disabled={pending}
            className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid transition-colors disabled:opacity-60"
          >
            🔑 Create Account
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Secretary Accounts"
        subtitle="Manage login access and permissions for each secretary"
      >
        {secretaries.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No secretary accounts yet
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {secretaries.map((s) => (
              <div
                key={s.id}
                className="border border-gray-200 rounded-lg p-4 flex flex-wrap items-center gap-6"
              >
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold text-navy">{s.full_name}</div>
                  <div className="text-xs text-gray-400">{s.email}</div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={s.is_active}
                    onChange={(e) => toggleActive(s.id, e.target.checked)}
                  />
                  Active
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={s.can_view_revenue}
                    onChange={(e) => toggleRevenue(s.id, e.target.checked)}
                  />
                  Revenue Visibility
                </label>

                <button
                  onClick={() => resetPassword(s.id, s.full_name)}
                  disabled={pending}
                  className="px-3 py-1.5 text-xs font-medium text-navy border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-60"
                >
                  🔄 Reset Password
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </>
  );
}
