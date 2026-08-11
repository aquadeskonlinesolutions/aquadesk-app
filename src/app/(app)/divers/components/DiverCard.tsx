"use client";

import Link from "next/link";
import type { DiverCard as DiverCardType } from "../data";
import { CERT_LEVEL_LABELS } from "../constants";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// Mirrors the live app's diverMiniCard (divers.html) — used in both Group
// Management's member drill-down (showBilling: a day-by-day breakdown) and
// Individual Management (showBilling=false: running bill + balance).
export function DiverCard({
  card,
  variant,
  selected,
  onToggleSelect,
  showGroupButton,
  onAddToGroupSelection,
  showRemove,
  onRemove,
  onAcknowledgeMedical,
}: {
  card: DiverCardType;
  variant: "group-member" | "individual";
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  showGroupButton?: boolean;
  onAddToGroupSelection?: () => void;
  showRemove?: boolean;
  onRemove?: () => void;
  onAcknowledgeMedical?: () => void;
}) {
  const disabled = card.alreadyInScheduling;

  return (
    <label className="flex flex-col border border-gray-200 rounded-lg p-3 gap-2 bg-white">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled}
          onChange={(e) => onToggleSelect(e.target.checked)}
          className="mt-0.5"
        />
        <div className="text-sm font-semibold text-navy">
          {card.firstName} {card.lastName}
        </div>
      </div>

      <div className="text-xs text-gray-500 grid gap-0.5">
        <div>{CERT_LEVEL_LABELS[card.certificationLevel] ?? card.certificationLevel ?? "No cert"}</div>
        <div>Arrival: {fmtDate(card.arrivalDate)}</div>
      </div>

      <div className="grid gap-0.5 text-xs bg-off-white rounded-md px-2 py-1.5">
        {variant === "group-member" ? (
          card.dayBreakdown.length > 0 ? (
            <>
              {card.dayBreakdown.map((d) => (
                <div key={d.date} className="flex justify-between">
                  <span className="text-gray-500">{fmtDate(d.date)}</span>
                  <span className="font-medium text-navy">{peso(d.total)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-200 pt-0.5 mt-0.5">
                <span className="text-gray-500">Total Dives</span>
                <span className="font-medium text-navy">{card.totalDives}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Bill</span>
                <span className="font-semibold text-navy">{peso(card.totalBill)}</span>
              </div>
            </>
          ) : (
            <span className="text-gray-400">No activity yet</span>
          )
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-gray-500">Running Bill</span>
              <span className="font-medium text-navy">{peso(card.runningBill)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Balance</span>
              <span className="font-semibold text-navy">{peso(card.balance)}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {card.alreadyInScheduling && (
          <span className="text-xs font-medium bg-orange-light text-orange px-1.5 py-0.5 rounded">
            Already in Scheduling
          </span>
        )}
        {card.billClosed && (
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            ✓ Bill Closed{card.billClosedAt ? ` ${fmtDate(card.billClosedAt)}` : ""}
          </span>
        )}
        {card.medicalFlag &&
          (card.medicalAcknowledged ? (
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              ⚕ Medical Note
            </span>
          ) : (
            <button
              type="button"
              onClick={onAcknowledgeMedical}
              className="text-xs font-medium bg-red-light text-red px-1.5 py-0.5 rounded hover:underline"
            >
              🚨 Medical Flag — tap to acknowledge
            </button>
          ))}
        {card.isMinor && (
          <span className="text-xs font-medium bg-orange-light text-orange px-1.5 py-0.5 rounded">
            👶 Minor
          </span>
        )}
        {card.staleDive && (
          <span className="text-xs font-medium bg-orange-light text-orange px-1.5 py-0.5 rounded">
            🕐 Last dive 6mo+ ago
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto pt-1">
        <Link
          href={`/diver-form/${card.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-teal hover:underline"
        >
          Open Form ↗
        </Link>
        <div className="flex gap-2">
          {showRemove && (
            <button type="button" onClick={onRemove} className="text-xs text-red hover:underline">
              Remove
            </button>
          )}
          {showGroupButton && (
            <button type="button" onClick={onAddToGroupSelection} className="text-xs text-gray-500 hover:underline">
              + Group
            </button>
          )}
        </div>
      </div>
    </label>
  );
}
