import type { Hash, LocalAccount } from "@tap/core";
import type { TamperField, TapCoreLike } from "@tap/core/testing";
import type { ChargeState } from "./charge-machine";

export type UseChargeOptions = {
  account: LocalAccount;
  merchantName: string;
  transport?: "nfc" | "qr";
  demoTamper?: TamperField | null;
  core?: TapCoreLike;
};

export type UseChargeResult = {
  state: ChargeState;
  amount?: bigint;
  url?: string;
  expiresAt?: Date;
  txHash?: Hash | null;
  error?: { code: string; message: string };
  start(amount: bigint): Promise<void>;
  cancel(): Promise<void>;
  reset(): void;
};

export function useCharge(_options: UseChargeOptions): UseChargeResult {
  throw new Error("not implemented: useCharge");
}
