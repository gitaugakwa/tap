import { describe, expect, test } from "bun:test";
import { hashTypedData, toHex } from "viem";
import { DEFAULT_TOKEN, PAYMENT_CHAIN_ID, paymentChains } from "../../src/config/chains";
import { TapConfigError } from "../../src/errors";
import { getTapPayDomain, hashRequest, PAYMENT_REQUEST_TYPES } from "../../src/request/sign";
import type { PaymentRequest } from "../../src/types";

const request: PaymentRequest = {
  merchant: "0x1111111111111111111111111111111111111111",
  token: DEFAULT_TOKEN,
  amount: 5_000_000n,
  nonce: toHex(new Uint8Array(32).fill(1)),
  expiry: 1_790_000_000n,
  merchantName: "yoyogi-market.tap.eth",
};

describe("TapPay typed data", () => {
  test("matches the locked Solidity field order and types", () => {
    expect(PAYMENT_REQUEST_TYPES).toEqual({
      PaymentRequest: [
        { name: "merchant", type: "address" },
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "bytes32" },
        { name: "expiry", type: "uint64" },
        { name: "merchantName", type: "string" },
      ],
    });
  });

  test("uses the allowlisted TapPay domain", () => {
    expect(getTapPayDomain()).toEqual({
      name: "TapPay",
      version: "1",
      chainId: PAYMENT_CHAIN_ID,
      verifyingContract: paymentChains[PAYMENT_CHAIN_ID].tapPay,
    });
    expect(() => getTapPayDomain(1)).toThrow(TapConfigError);
  });

  test("hashes the complete request as EIP-712 typed data", () => {
    expect(hashRequest(request)).toBe(
      hashTypedData({
        domain: getTapPayDomain(),
        types: PAYMENT_REQUEST_TYPES,
        primaryType: "PaymentRequest",
        message: request,
      }),
    );
  });
});
