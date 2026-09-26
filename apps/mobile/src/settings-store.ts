import { useSyncExternalStore } from "react";

export type AppSettings = {
  role: "merchant" | "customer" | null;
  merchantName: string;
  transport: "nfc" | "qr";
};

export const defaultSettings: AppSettings = {
  role: null,
  merchantName: "yoyogi-market.tap.eth",
  transport: "nfc",
};

let state: AppSettings = defaultSettings;
const listeners = new Set<() => void>();

function getSnapshot(): AppSettings {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateSettings(patch: Partial<AppSettings>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function useSettings(): [AppSettings, typeof updateSettings] {
  return [useSyncExternalStore(subscribe, getSnapshot), updateSettings];
}
