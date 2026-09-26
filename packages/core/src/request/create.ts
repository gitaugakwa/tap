import type { Address } from "viem";
import type { PaymentRequest } from "../types";

export function newChargeRequest(_options: {
  merchant: Address;
  merchantName: string;
  amount: bigint;
  token?: Address;
}): PaymentRequest {
  throw new Error("not implemented: newChargeRequest");
}
