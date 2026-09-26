import { afterEach, describe, expect, test } from "bun:test";
import { type Address, size } from "viem";
import { DEFAULT_TOKEN } from "../../src/config/chains";
import { configureTap } from "../../src/config/clients";
import { TapInputError } from "../../src/errors";
import { newChargeRequest } from "../../src/request/create";

const merchant: Address = "0x1111111111111111111111111111111111111111";

afterEach(() => configureTap());

describe("newChargeRequest", () => {
  test("normalizes the name and fills trusted request fields", () => {
    configureTap({ now: () => new Date("2026-09-26T00:00:00.000Z") });

    const request = newChargeRequest({
      merchant,
      merchantName: "YOYOGI-MARKET.tap.eth",
      amount: 5_000_000n,
    });

    expect(request).toMatchObject({
      merchant,
      merchantName: "yoyogi-market.tap.eth",
      amount: 5_000_000n,
      token: DEFAULT_TOKEN,
      expiry: 1_790_380_920n,
    });
    expect(size(request.nonce)).toBe(32);
  });

  test("creates a fresh nonce for every charge", () => {
    const options = { merchant, merchantName: "yoyogi-market.tap.eth", amount: 1n };
    expect(newChargeRequest(options).nonce).not.toBe(newChargeRequest(options).nonce);
  });

  test("canonicalizes an allowlisted token address", () => {
    const request = newChargeRequest({
      merchant,
      merchantName: "yoyogi-market.tap.eth",
      amount: 1n,
      token: DEFAULT_TOKEN.toLowerCase() as Address,
    });
    expect(request.token).toBe(DEFAULT_TOKEN);
  });

  test.each([0n, -1n])("rejects non-positive amount %s", (amount) => {
    expect(() =>
      newChargeRequest({ merchant, merchantName: "yoyogi-market.tap.eth", amount }),
    ).toThrow(TapInputError);
  });

  test("rejects a token outside the allowlist", () => {
    expect(() =>
      newChargeRequest({
        merchant,
        merchantName: "yoyogi-market.tap.eth",
        amount: 1n,
        token: "0x0000000000000000000000000000000000000001",
      }),
    ).toThrow(TapInputError);
  });
});
