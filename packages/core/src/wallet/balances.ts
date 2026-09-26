import type { Address } from "viem";
import type { WalletBalances } from "../types";

export function getWalletBalances(_address: Address): Promise<WalletBalances> {
  throw new Error("not implemented: getWalletBalances");
}
