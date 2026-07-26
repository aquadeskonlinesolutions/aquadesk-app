"use client";

import { useState, useTransition } from "react";
import { saveDiverEquipment } from "../actions";
import type { DiverDetail, EquipmentRentalItem } from "../data";

// Local copy of the same size-category mapping used at registration time
// (src/app/register/RegistrationWizard.tsx) — small enough that duplicating
// it here beats importing across an unrelated page boundary, matching this
// project's existing small-pure-helper duplication precedent.
const SIZE_OPTIONS: Record<string, string[]> = {
  bcd: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  wetsuit: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"],
  fins: ["S", "M", "L", "XL", "XXL", "XXXL"],
  boots: ["38", "39", "40", "41", "42", "43", "44", "45", "46"],
};

function sizeCategoryFor(itemKey: string): string | null {
  if (itemKey.includes("bcd")) return "bcd";
  if (itemKey.includes("wetsuit")) return "wetsuit";
  if (itemKey.includes("fin")) return "fins";
  if (itemKey.includes("boot")) return "boots";
  return null;
}

function isWeightsItem(itemKey: string): boolean {
  return itemKey.includes("weight");
}

type ParsedEquipment = { items: { name: string; size: string | null; kg?: number | null }[]; computer: boolean };

function parseEquipmentRequested(raw: string | null): ParsedEquipment {
  if (!raw) return { items: [], computer: false };
  try {
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      computer: !!parsed.computer,
    };
  } catch {
    return { items: [], computer: false };
  }
}

export function EquipmentModal({
  diver,
  rentalItems,
  onClose,
  onSaved,
}: {
  diver: DiverDetail;
  rentalItems: EquipmentRentalItem[];
  onClose: () => void;
  onSaved: (d: DiverDetail) => void;
}) {
  const initial = parseEquipmentRequested(diver.equipmentRequested);
  const [needsEquipment, setNeedsEquipment] = useState(diver.needsEquipment);
  const [selections, setSelections] = useState<Record<string, string | null>>(
    Object.fromEntries(
      initial.items.map((i) => [
        i.name,
        isWeightsItem(i.name) ? (i.kg != null ? String(i.kg) : null) : i.size,
      ]),
    ),
  );
  const [computer, setComputer] = useState(initial.computer);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const individualItems = rentalItems.filter((r) => {
    const n = r.itemName.toLowerCase();
    return n !== "computer" && n !== "dive computer" && n !== "full set";
  });
  const computerItem = rentalItems.find((r) => ["computer", "dive computer"].includes(r.itemName.toLowerCase()));

  function toggleItem(key: string, checked: boolean) {
    setSelections((prev) => {
      const next = { ...prev };
      if (checked) next[key] = next[key] ?? null;
      else delete next[key];
      return next;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const items = Object.entries(selections).map(([name, value]) =>
        isWeightsItem(name)
          ? { name, size: null, kg: value ? Number(value) : null }
          : { name, size: value },
      );
      const res = await saveDiverEquipment(diver.id, { needsEquipment, items, computer });
      if (res.error) {
        setError(res.error);
      } else {
        onSaved({
          ...diver,
          needsEquipment,
          equipmentRequested: JSON.stringify({ items, computer }),
        });
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-xl text-navy">Equipment</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-6 grid gap-4">
          {error && <div className="text-sm text-red">{error}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNeedsEquipment(true)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium ${needsEquipment ? "bg-navy text-white border-navy" : "border-gray-300 text-gray-600"}`}
            >
              Needs Equipment
            </button>
            <button
              type="button"
              onClick={() => setNeedsEquipment(false)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium ${!needsEquipment ? "bg-navy text-white border-navy" : "border-gray-300 text-gray-600"}`}
            >
              Has Own Gear
            </button>
          </div>

          {needsEquipment && (
            <div className="grid gap-2">
              {individualItems.length === 0 && (
                <p className="text-xs text-gray-400">No rental items configured in Settings.</p>
              )}
              {individualItems.map((r) => {
                const key = r.itemName.toLowerCase();
                const checked = key in selections;
                const sizeCategory = sizeCategoryFor(key);
                return (
                  <div key={r.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                    <label className="flex items-center gap-2 text-sm flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleItem(key, e.target.checked)}
                      />
                      {r.itemName}
                    </label>
                    {checked && isWeightsItem(key) && (
                      <input
                        type="number"
                        min={0}
                        max={20}
                        placeholder="kg"
                        value={selections[key] ?? ""}
                        onChange={(e) => setSelections((prev) => ({ ...prev, [key]: e.target.value || null }))}
                        className="w-16 border border-gray-300 rounded-md px-2 py-1 text-xs"
                      />
                    )}
                    {checked && sizeCategory && (
                      <select
                        value={selections[key] ?? ""}
                        onChange={(e) => setSelections((prev) => ({ ...prev, [key]: e.target.value || null }))}
                        className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                      >
                        <option value="">Size</option>
                        {SIZE_OPTIONS[sizeCategory].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {computerItem && (
            <label className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={computer} onChange={(e) => setComputer(e.target.checked)} />
              Computer Rental
              <span className="text-gray-400 text-xs">
                (₱{computerItem.rate.toLocaleString()}
                {computerItem.chargeType === "per_day" ? " per day" : ""})
              </span>
            </label>
          )}
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
            {pending ? "Saving…" : "Save Equipment"}
          </button>
        </div>
      </div>
    </div>
  );
}
