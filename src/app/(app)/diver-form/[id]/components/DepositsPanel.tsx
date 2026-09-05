"use client";

import { useState, useTransition } from "react";
import { addDeposit } from "../actions";
import type { Deposit } from "../data";
import { BASE_PAYMENT_CHANNELS, ADD_CHANNEL_VALUE } from "@/lib/payments";
import type { CustomChannelOption } from "@/lib/paymentChannels";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function DepositsPanel({
  diverId,
  visitId,
  deposits,
  receivedByDisplay,
  customChannels,
  onAdded,
}: {
  diverId: string;
  visitId: string;
  deposits: Deposit[];
  receivedByDisplay: string;
  customChannels: CustomChannelOption[];
  onAdded: (d: Deposit) => void;
}) {
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState<"cash" | "card" | "online">("cash");
  // Holds a base channel key, "" (none chosen), `custom:<id>` (an existing
  // per-dive-center channel), or ADD_CHANNEL_VALUE while composing a new
  // one via "+ Add Channel".
  const [channelSelection, setChannelSelection] = useState("");
  const [newChannelLabel, setNewChannelLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (method === "online" && !channelSelection) {
      setError("Select an Online channel.");
      return;
    }
    if (method === "online" && channelSelection === ADD_CHANNEL_VALUE && !newChannelLabel.trim()) {
      setError("Enter a channel name.");
      return;
    }
    const channel =
      method !== "online"
        ? null
        : channelSelection === ADD_CHANNEL_VALUE
          ? "custom"
          : channelSelection.startsWith("custom:")
            ? "custom"
            : channelSelection;
    const channelId = channelSelection.startsWith("custom:") ? channelSelection.slice(7) : null;
    startTransition(async () => {
      const amt = parseFloat(amount) || 0;
      const res = await addDeposit(
        diverId,
        visitId,
        amt,
        method,
        channel,
        channelId,
        channelSelection === ADD_CHANNEL_VALUE ? newChannelLabel : null,
        receivedByDisplay,
      );
      if (res.error) {
        setError(res.error);
      } else {
        const label = customChannels.find((c) => c.id === channelId)?.label ?? newChannelLabel;
        onAdded({
          id: crypto.randomUUID(),
          amount: amt,
          method,
          channel: channel as Deposit["channel"],
          customChannelId: channelId,
          channelLabel: method === "online" ? (channel === "custom" ? label : BASE_PAYMENT_CHANNELS.find(([k]) => k === channel)?.[1] || null) : null,
          depositDate: new Date().toISOString().slice(0, 10),
          receivedBy: receivedByDisplay,
        });
        setAmount("0");
        setChannelSelection("");
        setNewChannelLabel("");
      }
    });
  }

  return (
    <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="text-sm font-extrabold text-navy">Deposits</div>
        <div className="text-xs text-gray-500 mt-0.5">Pre-payment on file for this visit.</div>
      </div>

      <div className="p-5 border-b border-gray-200 flex flex-wrap items-end gap-3">
        {error && <div className="text-sm text-red w-full">{error}</div>}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
          <div className="flex gap-1.5">
            <select
              value={method}
              onChange={(e) => {
                const next = e.target.value as "cash" | "card" | "online";
                setMethod(next);
                if (next !== "online") {
                  setChannelSelection("");
                  setNewChannelLabel("");
                }
              }}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
            </select>
            {method === "online" && (
              <select
                value={channelSelection}
                onChange={(e) => {
                  setChannelSelection(e.target.value);
                  setNewChannelLabel("");
                }}
                className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              >
                <option value="">Channel</option>
                {BASE_PAYMENT_CHANNELS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
                {customChannels.map((c) => (
                  <option key={c.id} value={`custom:${c.id}`}>
                    {c.label}
                  </option>
                ))}
                <option value={ADD_CHANNEL_VALUE}>+ Add Channel</option>
              </select>
            )}
            {channelSelection === ADD_CHANNEL_VALUE && (
              <input
                value={newChannelLabel}
                onChange={(e) => setNewChannelLabel(e.target.value)}
                placeholder="New channel name"
                className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
              />
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Received By</label>
          <input
            value={receivedByDisplay}
            readOnly
            className="w-40 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-gray-100 text-gray-600"
          />
        </div>
        <button
          onClick={submit}
          disabled={pending}
          className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add Deposit"}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {deposits.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">No deposits on file.</div>
        ) : (
          deposits.map((d) => (
            <div key={d.id} className="px-5 py-3 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                {fmtDate(d.depositDate)} · {d.method}
                {d.method === "online" && d.channelLabel ? ` (${d.channelLabel})` : ""} · {d.receivedBy || "—"}
              </div>
              <div className="text-sm font-semibold text-navy">{peso(d.amount)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
