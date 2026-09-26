import { type Hex, hashTypedData, type LocalAccount } from "viem";
import { normalize } from "viem/ens";
import { getPaymentChain, PAYMENT_CHAIN_ID } from "../config/chains";
import { TapConfigError } from "../errors";
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

export function getTapPayDomain(chainId: number = PAYMENT_CHAIN_ID) {
  const config = getPaymentChain(chainId);
  if (!config) throw new TapConfigError(`Unsupported payment chain: ${chainId}`);

  return {
    name: "TapPay",
    version: "1",
    chainId,
    verifyingContract: config.tapPay,
  } as const;
}

export function signRequest(
  request: PaymentRequest,
  account: LocalAccount,
): Promise<SignedRequest> {
  const canonicalRequest = {
    ...request,
    merchantName: normalize(request.merchantName),
  };

  return account
    .signTypedData({
      domain: getTapPayDomain(),
      types: PAYMENT_REQUEST_TYPES,
      primaryType: "PaymentRequest",
      message: canonicalRequest,
    })
    .then((signature) => ({ chainId: PAYMENT_CHAIN_ID, request: canonicalRequest, signature }));
}

export function hashRequest(request: PaymentRequest, chainId = PAYMENT_CHAIN_ID): Hex {
  return hashTypedData({
    domain: getTapPayDomain(chainId),
    types: PAYMENT_REQUEST_TYPES,
    primaryType: "PaymentRequest",
    message: request,
  });
}
