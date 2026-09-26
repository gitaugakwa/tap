import { describe, expect, test } from "bun:test";
import { getAddress, type Hex, hashTypedData, recoverTypedDataAddress, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import hashVector from "../../../../contracts/test/fixtures/hash-vector.json";
import { DEFAULT_TOKEN, PAYMENT_CHAIN_ID, paymentChains } from "../../src/config/chains";
import { TapConfigError } from "../../src/errors";
import {
  getTapPayDomain,
  hashRequest,
  PAYMENT_REQUEST_TYPES,
  signRequest,
} from "../../src/request/sign";
import { decodeRequestUrl, encodeRequestUrl } from "../../src/request/url";
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

  test("matches the shared Solidity hash vector", () => {
    expect(hashVector.chainId).toBe(PAYMENT_CHAIN_ID);

    const chain = paymentChains[PAYMENT_CHAIN_ID];
    const configuredTapPay = chain.tapPay;
    const vectorTapPay = getAddress(hashVector.verifyingContract);
    const vectorRequest: PaymentRequest = {
      merchant: getAddress(hashVector.request.merchant),
      token: getAddress(hashVector.request.token),
      amount: BigInt(hashVector.request.amount),
      nonce: hashVector.request.nonce as Hex,
      expiry: BigInt(hashVector.request.expiry),
      merchantName: hashVector.request.merchantName,
    };

    Reflect.set(chain, "tapPay", vectorTapPay);
    try {
      expect(getTapPayDomain(hashVector.chainId).verifyingContract).toBe(vectorTapPay);
      expect(hashRequest(vectorRequest, hashVector.chainId)).toBe(hashVector.digest as Hex);
    } finally {
      Reflect.set(chain, "tapPay", configuredTapPay);
    }
  });

  test("canonicalizes before sign, encode, decode, and recover", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const merchantRequest = {
      ...request,
      merchant: account.address,
      merchantName: "YOYOGI-MARKET.tap.eth",
    };
    const signed = await signRequest(merchantRequest, account);
    const decoded = decodeRequestUrl(encodeRequestUrl(signed));

    expect(merchantRequest.merchantName).toBe("YOYOGI-MARKET.tap.eth");
    expect(decoded.request.merchantName).toBe("yoyogi-market.tap.eth");
    expect(decoded).toEqual(signed);
    expect(
      await recoverTypedDataAddress({
        domain: getTapPayDomain(),
        types: PAYMENT_REQUEST_TYPES,
        primaryType: "PaymentRequest",
        message: decoded.request,
        signature: decoded.signature,
      }),
    ).toBe(account.address);
  });
});
