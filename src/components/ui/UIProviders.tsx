"use client";

import { ConfirmProvider } from "./ConfirmDialog";
import { ToastProvider } from "./Toast";

export function UIProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
