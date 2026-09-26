import type { Address, Hash, Hex, LocalAccount } from "viem";
import type { SignedRequest } from "../types";

export function payWithPermit(_signed: SignedRequest, _account: LocalAccount): Promise<Hash> {
  throw new Error("not implemented: payWithPermit");
}

export function pay(_signed: SignedRequest, _account: LocalAccount): Promise<Hash> {
  throw new Error("not implemented: pay");
}

export function waitForPayment(_hash: Hash): Promise<"success" | "reverted"> {
  throw new Error("not implemented: waitForPayment");
}

export function isPaid(_merchant: Address, _nonce: Hex): Promise<boolean> {
  throw new Error("not implemented: isPaid");
}
