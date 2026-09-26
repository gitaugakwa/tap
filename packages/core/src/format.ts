import type { Address } from "viem";

export function formatAmount(_amount: bigint, _token?: Address): string {
  throw new Error("not implemented: formatAmount");
}

export function parseAmountInput(_input: string, _token?: Address): bigint {
  throw new Error("not implemented: parseAmountInput");
}
