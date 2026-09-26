import { type Address, getAddress } from "viem";
import { baseSepolia, sepolia } from "viem/chains";

export const PAYMENT_CHAIN_ID = 84532 as const;
export const ENS_CHAIN_ID = 11155111 as const;
export const ENS_PARENT = "tap.eth";

export const paymentChains = {
  [PAYMENT_CHAIN_ID]: {
    chain: baseSepolia,
    tapPay: "0x4c679b2dE8AE517fF12AA34A1bE0F81913678792" as Address,
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

export function getPaymentChain(chainId: number) {
  return chainId === PAYMENT_CHAIN_ID ? paymentChains[PAYMENT_CHAIN_ID] : undefined;
}

export function getTokenConfig(chainId: number, token: Address) {
  const chain = getPaymentChain(chainId);
  if (!chain) return undefined;

  try {
    const canonicalToken = getAddress(token);
    const entry = Object.entries(chain.tokens).find(
      ([address]) => getAddress(address) === canonicalToken,
    );
    if (!entry) return undefined;

    return { address: getAddress(entry[0]), ...entry[1] };
  } catch {
    return undefined;
  }
}
