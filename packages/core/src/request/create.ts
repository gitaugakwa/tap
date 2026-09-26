import { type Address, toHex } from "viem";
import { normalize } from "viem/ens";
import { DEFAULT_TOKEN, getTokenConfig, PAYMENT_CHAIN_ID } from "../config/chains";
import { getNow } from "../config/clients";
import { REQUEST_TTL_SECONDS } from "../config/constants";
import { TapInputError } from "../errors";
import type { PaymentRequest } from "../types";

export function newChargeRequest(options: {
  merchant: Address;
  merchantName: string;
  amount: bigint;
  token?: Address;
}): PaymentRequest {
  if (options.amount <= 0n) {
    throw new TapInputError("invalid_amount", "Charge amount must be greater than zero");
  }

  const token = getTokenConfig(PAYMENT_CHAIN_ID, options.token ?? DEFAULT_TOKEN);
  if (!token) throw new TapInputError("unknown_token", "Token is not supported");

  return {
    merchant: options.merchant,
    token: token.address,
    amount: options.amount,
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
    expiry: BigInt(Math.floor(getNow().getTime() / 1_000) + REQUEST_TTL_SECONDS),
    merchantName: normalize(options.merchantName),
  };
}
