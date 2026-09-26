import { describe, expect, test } from "bun:test";
import { toHex } from "viem";
import { DEFAULT_TOKEN, PAYMENT_CHAIN_ID } from "../../src/config/chains";
import { TapDecodeError, TapInputError } from "../../src/errors";
import { decodeRequestUrl, encodeRequestUrl } from "../../src/request/url";
import type { SignedRequest } from "../../src/types";

const signed: SignedRequest = {
  chainId: PAYMENT_CHAIN_ID,
  request: {
    merchant: "0x1111111111111111111111111111111111111111",
    merchantName: "yoyogi-market.tap.eth",
    token: DEFAULT_TOKEN,
    amount: 5_000_000n,
    expiry: 1_790_000_000n,
    nonce: toHex(new Uint8Array(32).fill(1)),
  },
  signature: toHex(new Uint8Array(65).fill(2)),
};

const encoded = encodeRequestUrl(signed);
const requiredParams = ["v", "c", "m", "n", "t", "a", "x", "k", "s"] as const;
const maxUint256 = (1n << 256n) - 1n;
const maxUint64 = (1n << 64n) - 1n;

function withParam(name: string, value: string): string {
  const url = new URL(encoded);
  url.searchParams.set(name, value);
  return url.toString();
}

function withByteLength(url: string, byteLength: number): string {
  return `${url}&u=${"x".repeat(byteLength - new TextEncoder().encode(url).byteLength - 3)}`;
}

function compactWithWidths(amount: bigint, expiry: bigint): string {
  const url = new URL(encoded);
  url.searchParams.set("c", "0");
  url.searchParams.set("n", "a");
  url.searchParams.set("a", amount.toString());
  url.searchParams.set("x", expiry.toString());
  return url.toString().replace(url.origin, "x:");
}

describe("request URL codec", () => {
  test("roundtrips every signed request field", () => {
    expect(decodeRequestUrl(encoded)).toEqual(signed);
  });

  test("emits stable ordered output under 400 bytes", () => {
    expect(encoded).toBe(
      `https://tap-pay.xyz/p?v=1&c=84532&m=0x1111111111111111111111111111111111111111&n=yoyogi-market.tap.eth&t=0x036CbD53842c5426634e7929541eC2318f3dCF7e&a=5000000&x=1790000000&k=0x0101010101010101010101010101010101010101010101010101010101010101&s=${signed.signature}`,
    );
    expect(new TextEncoder().encode(encoded).byteLength).toBeLessThan(400);
  });

  test.each(requiredParams.map((param) => [param] as const))(
    "rejects a missing %s parameter",
    (param) => {
      const url = new URL(encoded);
      url.searchParams.delete(param);
      expect(() => decodeRequestUrl(url.toString())).toThrow(TapDecodeError);
    },
  );

  test.each(requiredParams.map((param) => [param] as const))(
    "rejects a duplicate %s parameter",
    (param) => {
      const url = new URL(encoded);
      url.searchParams.append(param, url.searchParams.get(param) ?? "duplicate");
      expect(() => decodeRequestUrl(url.toString())).toThrow(TapDecodeError);
    },
  );

  test.each([
    ["v", "2"],
    ["c", "84532.0"],
    ["c", "9007199254740992"],
    ["m", "0xnot-an-address"],
    ["t", "0x1234"],
    ["a", "0"],
    ["a", "5.0"],
    ["x", "-1"],
    ["k", "0x1234"],
    ["s", toHex(new Uint8Array(64))],
    ["s", `${toHex(new Uint8Array(65))}f`],
  ])("rejects malformed %s", (param, value) => {
    expect(() => decodeRequestUrl(withParam(param, value))).toThrow(TapDecodeError);
  });

  test("rejects the wrong path", () => {
    expect(() => decodeRequestUrl(encoded.replace("/p?", "/pay?"))).toThrow(TapDecodeError);
  });

  test("accepts any host and ignores unknown parameters", () => {
    const url = new URL(encoded);
    url.host = "merchant.example:8080";
    url.searchParams.set("future", "ignored");
    expect(decodeRequestUrl(url.toString())).toEqual(signed);
  });

  test("normalizes the decoded merchant name", () => {
    expect(decodeRequestUrl(withParam("n", "YOYOGI-MARKET.tap.eth")).request.merchantName).toBe(
      "yoyogi-market.tap.eth",
    );
  });

  test("accepts Solidity integer maxima", () => {
    const maxAmountUrl = compactWithWidths(maxUint256, 0n);
    const maxExpiryUrl = compactWithWidths(1n, maxUint64);

    expect(new TextEncoder().encode(maxAmountUrl).byteLength).toBeLessThan(400);
    expect(decodeRequestUrl(maxAmountUrl).request.amount).toBe(maxUint256);
    expect(new TextEncoder().encode(maxExpiryUrl).byteLength).toBeLessThan(400);
    expect(decodeRequestUrl(maxExpiryUrl).request.expiry).toBe(maxUint64);
  });

  test.each([
    ["a", maxUint256 + 1n],
    ["x", maxUint64 + 1n],
  ])("rejects %s above its Solidity width", (param, value) => {
    const compact = param === "a" ? compactWithWidths(value, 0n) : compactWithWidths(1n, value);
    expect(new TextEncoder().encode(compact).byteLength).toBeLessThan(400);
    expect(() => decodeRequestUrl(compact)).toThrow(TapDecodeError);
  });

  test("accepts 399 bytes and unknown parameters", () => {
    expect(decodeRequestUrl(withByteLength(encoded, 399))).toEqual(signed);
  });

  test.each([[400], [401]])("rejects a %i-byte URL before parsing", (byteLength) => {
    expect(() => decodeRequestUrl(withByteLength(encoded, byteLength))).toThrow(TapDecodeError);
  });

  test("encoder emits 399 bytes and rejects 400 bytes", () => {
    const bytesNeeded = 400 - new TextEncoder().encode(encoded).byteLength;
    const at399 = {
      ...signed,
      request: {
        ...signed.request,
        merchantName: `${signed.request.merchantName}${"x".repeat(bytesNeeded - 1)}`,
      },
    };
    const at400 = {
      ...at399,
      request: { ...at399.request, merchantName: `${at399.request.merchantName}x` },
    };

    expect(new TextEncoder().encode(encodeRequestUrl(at399)).byteLength).toBe(399);
    expect(() => encodeRequestUrl(at400)).toThrow(TapInputError);
  });

  test("uses a stable malformed error code", () => {
    try {
      decodeRequestUrl("not a URL");
      throw new Error("expected decodeRequestUrl to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TapDecodeError);
      expect((error as TapDecodeError).code).toBe("malformed");
    }
  });
});
