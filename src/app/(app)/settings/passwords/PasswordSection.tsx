"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";

export function PasswordSection({
  title,
  subtitle,
  notice,
  hasPassword,
  saveAction,
}: {
  title: string;
  subtitle: string;
  notice: React.ReactNode;
  hasPassword: boolean;
  saveAction: (
    currentPassword: string,
    newPassword: string,
    hadPassword: boolean,
  ) => Promise<{ error?: string }>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!next || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const res = await saveAction(current, next, hasPassword);
      if (res.error) {
        setError(res.error);
        setSuccess(false);
      } else {
        setError(null);
        setSuccess(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    });
  }

  return (
    <SettingsSection title={title} subtitle={subtitle}>
      {notice}
      {error && <div className="mb-3 text-sm text-red">{error}</div>}
      {success && <div className="mb-3 text-sm text-green">Password updated.</div>}

      <div className="flex flex-wrap gap-4 mb-4">
        {hasPassword && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56"
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={pending}
        className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : `Update ${title}`}
      </button>
    </SettingsSection>
  );
}
