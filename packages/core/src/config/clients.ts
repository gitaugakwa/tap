import { createPublicClient, http, type PublicClient } from "viem";
import type { TapConfig } from "../types";
import { ensConfig, PAYMENT_CHAIN_ID, paymentChains } from "./chains";

let config: TapConfig = {};
let paymentClient: PublicClient | null = null;
let ensClient: PublicClient | null = null;

export function configureTap(nextConfig: TapConfig = {}): void {
  config = nextConfig;
  paymentClient = null;
  ensClient = null;
}

export function getNow(): Date {
  return config.now?.() ?? new Date();
}

export function getPaymentClient(): PublicClient {
  if (config.paymentClient) return config.paymentClient;

  paymentClient ??= createPublicClient({
    chain: paymentChains[PAYMENT_CHAIN_ID].chain,
    transport: http(config.rpcUrls?.payment),
  }) as PublicClient;

  return paymentClient;
}

export function getEnsClient(): PublicClient {
  if (config.ensClient) return config.ensClient;

  ensClient ??= createPublicClient({
    chain: ensConfig.chain,
    transport: http(config.rpcUrls?.ens),
  }) as PublicClient;

  return ensClient;
}
