import type { Address } from "viem";
import { baseSepolia, sepolia } from "viem/chains";

export const PAYMENT_CHAIN_ID = 84532 as const;
export const ENS_CHAIN_ID = 11155111 as const;
export const ENS_PARENT = "tap.eth";

export const paymentChains = {
  [PAYMENT_CHAIN_ID]: {
    chain: baseSepolia,
    tapPay: "0x0000000000000000000000000000000000000000" as Address,
    tokens: {
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e": {
        symbol: "USDC",
        decimals: 6,
        display: "usd",
      },
    },
  },
} as const;

export const ensConfig = {
  chain: sepolia,
  parent: ENS_PARENT,
  merchantRegistrar: "0x0000000000000000000000000000000000000000" as Address,
} as const;

export const DEFAULT_TOKEN = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
