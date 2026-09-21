"use client";

export type ToastItem = { id: number; text: string };

let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToast(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function toastSnapshot(): ToastItem[] {
  return toasts;
}

export function flash(text: string): void {
  const item = { id: nextId, text };
  nextId += 1;
  toasts = [...toasts, item];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((row) => row.id !== item.id);
    emit();
  }, 2200);
}
