"use client";

import { useEffect, useState, type ReactNode } from "react";

type ToastType = "success" | "error" | "info";

/**
 * Non-blocking auto-dismiss toast. Renders fixed at the bottom,
 * above the tab bar. Auto-dismisses after a short delay.
 */
export function Toast({
  message,
  type = "info",
  onDismiss,
}: {
  message: string;
  type?: ToastType;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 2600);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={`mobile-toast ${type === "success" ? "is-success" : ""} ${
        type === "error" ? "is-error" : ""
      }`}
      role={type === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}

/** Simple hook to surface a toast message with auto-dismiss. */
export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    key: number;
  } | null>(null);

  const show = (message: string, type: ToastType = "info") => {
    setToast({ message, type, key: Date.now() });
  };

  const render = (): ReactNode =>
    toast ? (
      <Toast
        key={toast.key}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast(null)}
      />
    ) : null;

return { show, render };
}
