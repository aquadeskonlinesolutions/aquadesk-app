"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmState = {
  message: string;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Promise-based replacement for window.confirm — one dialog instance
// owned by the provider, matching this app's existing modal chrome
// (bg-black/40 overlay, bg-white rounded-2xl shadow-lg, font-display
// title) instead of every call site hand-rolling its own modal state.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, options, resolve });
    });
  }, []);

  function settle(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-display text-xl text-navy">{state.options.title ?? "Confirm"}</div>
              <button
                onClick={() => settle(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">{state.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
              <button onClick={() => settle(false)} className="px-4 py-2 text-sm text-gray-600">
                {state.options.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => settle(true)}
                autoFocus
                className={`px-4 py-2 text-sm font-medium rounded-lg text-white hover:opacity-90 ${
                  state.options.danger ? "bg-red" : "bg-navy hover:bg-navy-dark"
                }`}
              >
                {state.options.confirmLabel ?? (state.options.danger ? "Delete" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
