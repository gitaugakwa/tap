import {
  createPublicClient,
  createWalletClient,
  http,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
} from "viem";
import type { TapConfig } from "../types";
import { ensConfig, PAYMENT_CHAIN_ID, paymentChains } from "./chains";

let config: TapConfig = {};
let paymentClient: PublicClient | null = null;
let ensClient: PublicClient | null = null;

type PaymentWalletClient = WalletClient<
  ReturnType<typeof http>,
  (typeof paymentChains)[typeof PAYMENT_CHAIN_ID]["chain"],
  LocalAccount
>;

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

export function getPaymentWalletClient(account: LocalAccount): PaymentWalletClient {
  if (config.paymentWalletClient) {
    return config.paymentWalletClient as PaymentWalletClient;
  }
  return createWalletClient({
    account,
    chain: paymentChains[PAYMENT_CHAIN_ID].chain,
    transport: http(config.rpcUrls?.payment),
  });
}

export function getEnsClient(): PublicClient {
  if (config.ensClient) return config.ensClient;

  ensClient ??= createPublicClient({
    chain: ensConfig.chain,
    transport: http(config.rpcUrls?.ens),
  }) as PublicClient;

  return ensClient;
}
