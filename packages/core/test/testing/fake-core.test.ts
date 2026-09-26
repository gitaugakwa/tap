import { describe, expect, test } from "bun:test";
import { toHex } from "viem";
import { createFakeCore, fakeMerchantAccount, tamperRequestUrl } from "../../src/testing";

describe("createFakeCore", () => {
  test("signs and roundtrips a request offline", async () => {
    const core = createFakeCore();
    const request = core.newChargeRequest({
      merchant: fakeMerchantAccount.address,
      merchantName: "YOYOGI-MARKET.tap.eth",
      amount: 5_000_000n,
    });

    const signed = await core.signRequest(request, fakeMerchantAccount);
    const decoded = core.decodeRequestUrl(core.encodeRequestUrl(signed));
    const verified = await core.verifyRequest(decoded);

    expect(decoded).toEqual(signed);
    expect(verified).toMatchObject({
      ok: true,
      displayName: "Takoyaki Stand",
      displayAmount: "$5.00",
    });
  });

  test("applies method overrides", async () => {
    const core = createFakeCore({ waitForPayment: async () => "reverted" });
    const result = await core.waitForPayment(toHex(new Uint8Array(32)));
    expect(result).toBe("reverted");
  });
});

test("tamperRequestUrl changes each signed field", async () => {
  const core = createFakeCore();
  const request = core.newChargeRequest({
    merchant: fakeMerchantAccount.address,
    merchantName: "yoyogi-market.tap.eth",
    amount: 5_000_000n,
  });
  const original = core.encodeRequestUrl(await core.signRequest(request, fakeMerchantAccount));

  for (const field of ["m", "n", "t", "a", "x", "k", "c"] as const) {
    expect(tamperRequestUrl(original, field)).not.toBe(original);
  }
});
