"use client";

import { useState, useTransition } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { saveGovtFee, deleteGovtFee } from "./actions";
import type { GovtFee } from "./data";

function peso(n: number) {
  return `₱${n.toLocaleString()}`;
}

export function GovtFeesSection({ fees }: { fees: GovtFee[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setName("");
    setAmount("");
    setError(null);
  }
  function startEdit(f: GovtFee) {
    setEditingId(f.id);
    setAdding(false);
    setName(f.fee_name);
    setAmount(String(f.amount));
    setError(null);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }
  function save() {
    startTransition(async () => {
      const res = await saveGovtFee(editingId, name, parseFloat(amount) || 0);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setAdding(false);
        setEditingId(null);
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      await deleteGovtFee(id);
    });
  }

  return (
    <SettingsSection
      title="Government Fees"
      subtitle="Fee rates your center remits to government agencies per dive"
      action={
        !adding && (
          <button
            onClick={startAdd}
            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors"
          >
            + Add Fee
          </button>
        )
      }
    >
      {error && <div className="mb-3 text-sm text-red">{error}</div>}

      {(adding || editingId) && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-off-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fee Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Amount (PHP)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm w-28"
            />
          </div>
          <button
            onClick={save}
            disabled={pending}
            className="px-3 py-1.5 text-sm font-medium bg-teal text-white rounded-md hover:bg-teal-mid disabled:opacity-60"
          >
            Save
          </button>
          <button onClick={cancel} className="px-3 py-1.5 text-sm text-gray-600">
            Cancel
          </button>
        </div>
      )}

      {fees.length === 0 && !adding ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No government fees configured yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fees.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-4 px-4 py-3 border border-gray-200 rounded-lg"
            >
              <div className="flex-1 font-medium text-navy">{f.fee_name}</div>
              <div className="font-semibold text-navy">{peso(f.amount)}</div>
              <button
                onClick={() => startEdit(f)}
                className="text-xs text-teal hover:text-navy"
              >
                Edit
              </button>
              <button
                onClick={() => remove(f.id)}
                className="text-xs text-red hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
