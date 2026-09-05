"use client";

import { useEffect } from "react";
import { ConfirmProvider } from "./ConfirmDialog";
import { SettlePaymentProvider } from "./SettlePaymentDialog";
import { ToastProvider } from "./Toast";

// A focused <input type="number"> changes value on mouse-wheel scroll —
// standard browser behavior, but an easy way to accidentally edit a
// number field while scrolling the page past it. Blurring it on wheel
// (rather than preventDefault, which would also block the page from
// scrolling) makes the scroll pass through normally instead.
function useDisableNumberInputScroll() {
  useEffect(() => {
    function onWheel() {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === "number") {
        el.blur();
      }
    }
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);
}

export function UIProviders({ children }: { children: React.ReactNode }) {
  useDisableNumberInputScroll();
  return (
    <ToastProvider>
      <ConfirmProvider>
        <SettlePaymentProvider>{children}</SettlePaymentProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
