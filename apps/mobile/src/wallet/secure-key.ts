import type { Hex } from "@tap/core";
import { generatePrivateKey } from "@tap/core";
import * as SecureStore from "expo-secure-store";

const WALLET_KEY = "tap.wallet.v1";

export async function loadOrCreatePrivateKey(): Promise<Hex> {
  const existing = await SecureStore.getItemAsync(WALLET_KEY);
  if (existing) return existing as Hex;

  const created = generatePrivateKey();
  await SecureStore.setItemAsync(WALLET_KEY, created);
  return created;
}

export async function resetPrivateKey(): Promise<Hex> {
  await SecureStore.deleteItemAsync(WALLET_KEY);
  return loadOrCreatePrivateKey();
}
