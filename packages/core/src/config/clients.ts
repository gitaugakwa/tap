import type { PublicClient } from "viem";
import type { TapConfig } from "../types";

let config: TapConfig = {};

export function configureTap(nextConfig: TapConfig = {}): void {
  config = nextConfig;
}

export function getNow(): Date {
  return config.now?.() ?? new Date();
}

export function getPaymentClient(): PublicClient {
  throw new Error("not implemented: getPaymentClient");
}

export function getEnsClient(): PublicClient {
  throw new Error("not implemented: getEnsClient");
}
