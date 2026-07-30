"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastVariant = "info" | "error";
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ShowToastFn = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ShowToastFn | null>(null);

let nextToastId = 0;

// Auto-dismissing, non-blocking replacement for window.alert — a
// blocking modal is the wrong shape for a fire-and-forget message like
// "Copied." or a save confirmation.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback<ShowToastFn>((message, variant = "info") => {
    const id = ++nextToastId;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-4 right-4 z-[60] grid gap-2 w-full max-w-sm pointer-events-none print:hidden">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg border bg-white text-sm font-medium ${
              t.variant === "error" ? "border-red/30 text-red" : "border-teal/30 text-navy"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
