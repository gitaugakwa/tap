import { describe, expect, test } from "bun:test";
import { toHex } from "viem";
import { DEFAULT_TOKEN, PAYMENT_CHAIN_ID } from "../../src/config/chains";
import { TapDecodeError } from "../../src/errors";
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

function withParam(name: string, value: string): string {
  const url = new URL(encoded);
  url.searchParams.set(name, value);
  return url.toString();
}

describe("request URL codec", () => {
  test("roundtrips every signed request field", () => {
    expect(decodeRequestUrl(encoded)).toEqual(signed);
  });

  test("emits stable ordered output under 400 bytes", () => {
    expect(encoded).toBe(
      `https://tap.xyz/p?v=1&c=84532&m=0x1111111111111111111111111111111111111111&n=yoyogi-market.tap.eth&t=0x036CbD53842c5426634e7929541eC2318f3dCF7e&a=5000000&x=1790000000&k=0x0101010101010101010101010101010101010101010101010101010101010101&s=${signed.signature}`,
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
