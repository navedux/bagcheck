"use client";

import { useSyncExternalStore } from "react";
import { subscribeToast, toastSnapshot, type ToastItem } from "@/lib/toast";

const EMPTY: ToastItem[] = [];

export function ToastHost() {
  const items = useSyncExternalStore(subscribeToast, toastSnapshot, () => EMPTY);

  if (items.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((item) => (
        <p key={item.id} className="toast flex items-center gap-2">
          <i aria-hidden="true" className="ri-check-line" />
          {item.text}
        </p>
      ))}
    </div>
  );
}
