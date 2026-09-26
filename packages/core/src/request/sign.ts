import type { Hex, LocalAccount } from "viem";
import type { PaymentRequest, SignedRequest } from "../types";

export const PAYMENT_REQUEST_TYPES = {
  PaymentRequest: [
    { name: "merchant", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "expiry", type: "uint64" },
    { name: "merchantName", type: "string" },
  ],
} as const;

export function signRequest(
  _request: PaymentRequest,
  _account: LocalAccount,
): Promise<SignedRequest> {
  throw new Error("not implemented: signRequest");
}

export function hashRequest(_request: PaymentRequest, _chainId?: number): Hex {
  throw new Error("not implemented: hashRequest");
}
