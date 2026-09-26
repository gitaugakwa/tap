import type { PublicClient } from "viem";
import type { TapConfig } from "../types";

export function configureTap(_config: TapConfig = {}): void {
  throw new Error("not implemented: configureTap");
}

export function getPaymentClient(): PublicClient {
  throw new Error("not implemented: getPaymentClient");
}

export function getEnsClient(): PublicClient {
  throw new Error("not implemented: getEnsClient");
}
