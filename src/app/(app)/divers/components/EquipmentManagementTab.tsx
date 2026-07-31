"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { EquipmentPrepDiver } from "../data";
import { getEquipmentPrepDivers, getGearInventoryCounts, saveEquipmentNotes } from "../actions";
import { GEAR_ITEMS } from "@/app/(app)/settings/inventory/constants";

const EQUIPMENT_COLUMNS = ["BCD", "Wetsuit", "Fins", "Mask", "Boots", "Regulator", "Weights", "Snorkel"];

function tomorrowManila(): string {
  const now = new Date();
  const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  manilaNow.setDate(manilaNow.getDate() + 1);
  return manilaNow.toISOString().slice(0, 10);
}

function parseEquipment(raw: string | null): { items: { name: string; size: string | null; kg?: number | null }[]; computer: boolean } {
  if (!raw) return { items: [], computer: false };
  try {
    const parsed = JSON.parse(raw);
    return { items: Array.isArray(parsed.items) ? parsed.items : [], computer: !!parsed.computer };
  } catch {
    return { items: [], computer: false };
  }
}

// No live-app precedent for per-item ownership — needs_equipment is an
// all-or-nothing per-diver flag (matching diver-form.html's real "None —
// diver has own gear" semantics), so a diver with their own gear shows
// "Own" across every column rather than a per-item toggle. Checkmarks are
// dropped entirely per the user's explicit ask — a requested item just
// shows its size/kg value, or "Requested" when it has neither.
function findRequestedItem(
  items: { name: string; size: string | null; kg?: number | null }[],
  column: string,
) {
  return items.find((i) => i.name.toLowerCase().includes(column.toLowerCase()));
}

function cellValue(
  needsEquipment: boolean,
  items: { name: string; size: string | null; kg?: number | null }[],
  column: string,
): string {
  if (!needsEquipment) return "Own";
  const match = findRequestedItem(items, column);
  if (!match) return "";
  if (match.name.toLowerCase().includes("weight") && match.kg != null) return `${match.kg}kg`;
  return match.size ?? "Requested";
}

export function EquipmentManagementTab({ initialDate }: { initialDate: string | null }) {
  const [date, setDate] = useState(initialDate || tomorrowManila());
  const [divers, setDivers] = useState<EquipmentPrepDiver[]>([]);
  const [gearCounts, setGearCounts] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function load(d: string) {
    startTransition(async () => {
      // Fetched together (not sequential awaits) since both feed the same
      // render — this codebase's standing rule for anything that derives
      // UI from more than one source (retrospective #20).
      const [rows, counts] = await Promise.all([getEquipmentPrepDivers(d), getGearInventoryCounts()]);
      setDivers(rows);
      setGearCounts(counts);
      setRemarks(Object.fromEntries(rows.map((r) => [r.id, r.equipmentNotes ?? ""])));
    });
  }

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onRemarkChange(diverId: string, value: string) {
    setRemarks((prev) => ({ ...prev, [diverId]: value }));
    if (debounceRef.current[diverId]) clearTimeout(debounceRef.current[diverId]);
    debounceRef.current[diverId] = setTimeout(() => {
      saveEquipmentNotes(diverId, value);
    }, 500);
  }

  const grouped = new Map<string, EquipmentPrepDiver[]>();
  divers.forEach((d) => {
    const key = d.groupName ?? "Individual Divers";
    const list = grouped.get(key) ?? [];
    list.push(d);
    grouped.set(key, list);
  });

  // Dive-center-wide tally (not scoped per group section, since inventory is
  // shared) — only the 6 gear items Settings > Inventory actually tracks
  // (Weights/Snorkel have no matching stock item, so nothing to cross-check).
  const shortages = EQUIPMENT_COLUMNS.filter((c) => GEAR_ITEMS.some((g) => g.toLowerCase() === c.toLowerCase()))
    .map((c) => {
      const requested = divers.reduce((sum, d) => {
        if (!d.needsEquipment) return sum;
        const { items } = parseEquipment(d.equipmentRequested);
        return findRequestedItem(items, c) ? sum + 1 : sum;
      }, 0);
      const available = gearCounts[c] ?? 0;
      return { column: c, requested, available };
    })
    .filter((s) => s.requested > s.available);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 print:hidden">
        <label className="text-sm text-gray-600">Arrival date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            load(e.target.value);
          }}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
        />
        <button
          onClick={() => window.print()}
          className="ml-auto px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-gray-300 text-navy hover:bg-gray-50"
        >
          🖨️ Print
        </button>
      </div>

      {shortages.length > 0 && (
        <div className="print:hidden rounded-md border border-orange/30 bg-orange-light px-3 py-2 text-sm text-orange-dark">
          <span className="font-semibold">Gear shortage for {date}:</span>{" "}
          {shortages.map((s) => `${s.column} (${s.requested} requested, ${s.available} in stock)`).join(" · ")}
        </div>
      )}

      {pending && divers.length === 0 && <div className="text-sm text-gray-400 text-center py-8">Loading…</div>}

      {!pending && divers.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">No divers arriving on this date.</div>
      )}

      {[...grouped.entries()].map(([groupName, rows]) => (
        <div key={groupName} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200 text-sm font-semibold text-navy">{groupName}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Diver</th>
                  {EQUIPMENT_COLUMNS.map((c) => (
                    <th key={c} className="px-2 py-2 text-center whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center">Computer</th>
                  <th className="px-3 py-2 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const { items, computer } = parseEquipment(d.equipmentRequested);
                  return (
                    <tr key={d.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-navy whitespace-nowrap">
                        {d.firstName} {d.lastName}
                      </td>
                      {EQUIPMENT_COLUMNS.map((c) => (
                        <td key={c} className="px-2 py-2 text-center text-gray-600">
                          {cellValue(d.needsEquipment, items, c)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center text-gray-600">
                        {!d.needsEquipment ? "Own" : computer ? "Yes" : ""}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={remarks[d.id] ?? ""}
                          onChange={(e) => onRemarkChange(d.id, e.target.value)}
                          placeholder="Notes…"
                          className="print:hidden w-full border border-gray-200 rounded px-2 py-1 text-xs"
                        />
                        <span className="hidden print:inline">{remarks[d.id] ?? ""}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
