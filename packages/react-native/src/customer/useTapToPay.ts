import type { Hash, LocalAccount, SignedRequest, VerifyResult } from "@tap/core";
import type { TapCoreLike } from "@tap/core/testing";
import type { PayState } from "./pay-machine";

export type UseTapToPayOptions = {
  account: LocalAccount;
  core?: TapCoreLike;
};

export type UseTapToPayResult = {
  state: PayState;
  verify?: VerifyResult;
  signed?: SignedRequest;
  txHash?: Hash;
  error?: { code: string; message: string };
  startReading(): Promise<void>;
  submitUrl(url: string): Promise<void>;
  confirm(): Promise<void>;
  reset(): void;
};

export function useTapToPay(_options: UseTapToPayOptions): UseTapToPayResult {
  throw new Error("not implemented: useTapToPay");
}
