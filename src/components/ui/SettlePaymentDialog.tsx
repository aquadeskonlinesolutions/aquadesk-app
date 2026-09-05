"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { PAYMENT_CHANNEL_LABELS, type PaymentChannel } from "@/lib/payments";

type SettlePaymentOptions = {
  title?: string;
  confirmLabel?: string;
};

export type SettlePaymentResult = { method: "cash" | "card" | "online"; channel: PaymentChannel | null };

type SettlePaymentState = {
  message: string;
  options: SettlePaymentOptions;
  resolve: (value: SettlePaymentResult | null) => void;
};

type SettlePaymentFn = (message: string, options?: SettlePaymentOptions) => Promise<SettlePaymentResult | null>;

const SettlePaymentContext = createContext<SettlePaymentFn | null>(null);

// Same promise-based-dialog shape as ConfirmDialog.tsx, but for the one
// case a plain Yes/No confirm can't cover: settling a join ride / rental
// gear record, or marking a staff commission paid, all need to capture how
// it was paid (and, if Online, which channel) before the status can flip.
export function SettlePaymentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SettlePaymentState | null>(null);
  const [method, setMethod] = useState<"cash" | "card" | "online">("cash");
  const [channel, setChannel] = useState<PaymentChannel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settlePayment = useCallback<SettlePaymentFn>((message, options = {}) => {
    return new Promise<SettlePaymentResult | null>((resolve) => {
      setMethod("cash");
      setChannel(null);
      setError(null);
      setState({ message, options, resolve });
    });
  }, []);

  function settle(result: SettlePaymentResult | null) {
    state?.resolve(result);
    setState(null);
  }

  function confirmClick() {
    if (method === "online" && !channel) {
      setError("Select an Online channel.");
      return;
    }
    settle({ method, channel: method === "online" ? channel : null });
  }

  return (
    <SettlePaymentContext.Provider value={settlePayment}>
      {children}
      {state && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-display text-xl text-navy">{state.options.title ?? "Mark as Paid?"}</div>
              <button onClick={() => settle(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
                ×
              </button>
            </div>
            <div className="px-6 py-4 grid gap-3">
              <p className="text-sm text-gray-600">{state.message}</p>
              {error && <div className="text-sm text-red">{error}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                <select
                  value={method}
                  onChange={(e) => {
                    const next = e.target.value as "cash" | "card" | "online";
                    setMethod(next);
                    if (next !== "online") setChannel(null);
                    setError(null);
                  }}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="online">Online</option>
                </select>
              </div>
              {method === "online" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
                  <select
                    value={channel ?? ""}
                    onChange={(e) => {
                      setChannel((e.target.value || null) as PaymentChannel | null);
                      setError(null);
                    }}
                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    <option value="">Select channel</option>
                    {Object.entries(PAYMENT_CHANNEL_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
              <button onClick={() => settle(null)} className="px-4 py-2 text-sm text-gray-600">
                Cancel
              </button>
              <button
                onClick={confirmClick}
                autoFocus
                className="px-4 py-2 text-sm font-medium rounded-lg text-white hover:opacity-90 bg-navy hover:bg-navy-dark"
              >
                {state.options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettlePaymentContext.Provider>
  );
}

export function useSettlePayment(): SettlePaymentFn {
  const ctx = useContext(SettlePaymentContext);
  if (!ctx) throw new Error("useSettlePayment must be used within SettlePaymentProvider");
  return ctx;
}
