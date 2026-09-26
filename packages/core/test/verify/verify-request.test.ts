import { afterEach, describe, expect, test } from "bun:test";
import { type Address, type LocalAccount, type PublicClient, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DEFAULT_TOKEN, PAYMENT_CHAIN_ID } from "../../src/config/chains";
import { configureTap } from "../../src/config/clients";
import { signRequest } from "../../src/request/sign";
import { decodeRequestUrl, encodeRequestUrl } from "../../src/request/url";
import { tamperRequestUrl } from "../../src/testing";
import type { PaymentRequest, SignedRequest } from "../../src/types";
import { verifyRequest } from "../../src/verify/verify-request";

const merchantAccount = privateKeyToAccount(
  "0x1111111111111111111111111111111111111111111111111111111111111111",
);
const wrongAccount = privateKeyToAccount(
  "0x2222222222222222222222222222222222222222222222222222222222222222",
);
const contractMerchant = "0x3333333333333333333333333333333333333333" as Address;
const stranger = "0x4444444444444444444444444444444444444444" as Address;
const unknownToken = "0x5555555555555555555555555555555555555555" as Address;
const now = new Date("2026-09-26T00:00:00.000Z");
const futureExpiry = BigInt(Math.floor(now.getTime() / 1_000) + 120);

function publicClient(
  options: {
    ensAddress?: Address | null;
    displayName?: string | null;
    verifySignature?: boolean;
    failEns?: boolean;
    failSignature?: boolean;
    onVerify?: () => void;
  } = {},
): PublicClient {
  return {
    async getEnsAddress() {
      if (options.failEns) throw new Error("ENS RPC unavailable");
      return "ensAddress" in options ? (options.ensAddress ?? null) : merchantAccount.address;
    },
    async getEnsText() {
      if (options.failEns) throw new Error("ENS RPC unavailable");
      return options.displayName ?? "Takoyaki Stand";
    },
    async verifyTypedData() {
      options.onVerify?.();
      if (options.failSignature) throw new Error("payment RPC unavailable");
      return options.verifySignature ?? false;
    },
  } as unknown as PublicClient;
}

function configure(options: Parameters<typeof publicClient>[0] = {}): void {
  const client = publicClient(options);
  configureTap({ now: () => now, ensClient: client, paymentClient: client });
}

async function signedRequest(
  options: { request?: Partial<PaymentRequest>; signer?: LocalAccount } = {},
): Promise<SignedRequest> {
  const request: PaymentRequest = {
    merchant: merchantAccount.address,
    token: DEFAULT_TOKEN,
    amount: 5_000_000n,
    nonce: toHex(new Uint8Array(32).fill(1)),
    expiry: futureExpiry,
    merchantName: "e2e-merchant.tap.eth",
    ...options.request,
  };
  return signRequest(request, options.signer ?? merchantAccount);
}

afterEach(() => configureTap());

test("verifies an EOA request and returns only trusted display data", async () => {
  configure({ displayName: "E2E Test Merchant" });

  await expect(verifyRequest(await signedRequest())).resolves.toEqual({
    ok: true,
    ensName: "e2e-merchant.tap.eth",
    displayName: "E2E Test Merchant",
    tokenSymbol: "USDC",
    displayAmount: "$5.00",
    expiresAt: new Date(Number(futureExpiry) * 1_000),
  });
});

test("supports ERC-1271 contract merchant signatures", async () => {
  let fallbackCalls = 0;
  configure({
    ensAddress: contractMerchant,
    verifySignature: true,
    onVerify: () => fallbackCalls++,
  });
  const signed = await signedRequest({ request: { merchant: contractMerchant } });

  expect(await verifyRequest(signed)).toMatchObject({ ok: true });
  expect(fallbackCalls).toBe(1);
});

describe("ordered failures", () => {
  test("returns malformed for invalid runtime shapes", async () => {
    configure();
    const signed = await signedRequest();
    const malformed = {
      ...signed,
      request: { ...signed.request, amount: 0n },
    };
    expect(await verifyRequest(malformed)).toEqual({ ok: false, reason: "malformed" });
  });

  test("returns unknown_chain before signature or ENS work", async () => {
    configure();
    const signed = { ...(await signedRequest()), chainId: 1 };
    expect(await verifyRequest(signed)).toEqual({ ok: false, reason: "unknown_chain" });
  });

  test("returns unknown_token before signature or ENS work", async () => {
    configure();
    const signed = await signedRequest({ request: { token: unknownToken } });
    expect(await verifyRequest(signed)).toEqual({ ok: false, reason: "unknown_token" });
  });

  test("returns expired at the exact boundary", async () => {
    configureTap({
      now: () => new Date(Number(futureExpiry) * 1_000),
      ensClient: publicClient(),
      paymentClient: publicClient(),
    });
    expect(await verifyRequest(await signedRequest())).toEqual({ ok: false, reason: "expired" });
  });

  test("returns bad_signature and never throws when ERC-1271 RPC fails", async () => {
    configure({ failSignature: true });
    const signed = await signedRequest({ signer: wrongAccount });
    expect(await verifyRequest(signed)).toEqual({ ok: false, reason: "bad_signature" });
  });

  test("returns not_under_parent before ENS resolution", async () => {
    configure();
    const signed = await signedRequest({ request: { merchantName: "merchant.eth" } });
    expect(await verifyRequest(signed)).toEqual({ ok: false, reason: "not_under_parent" });
  });

  test("returns ens_unresolved for null and zero-address records", async () => {
    const signed = await signedRequest();
    configure({ ensAddress: null });
    expect(await verifyRequest(signed)).toEqual({ ok: false, reason: "ens_unresolved" });

    configure({ ensAddress: `0x${"0".repeat(40)}` as Address });
    expect(await verifyRequest(signed)).toEqual({ ok: false, reason: "ens_unresolved" });
  });

  test("returns ens_mismatch when ENS resolves to another wallet", async () => {
    configure({ ensAddress: stranger });
    expect(await verifyRequest(await signedRequest())).toEqual({
      ok: false,
      reason: "ens_mismatch",
    });
  });

  test("returns network_error and never throws when ENS is unavailable", async () => {
    configure({ failEns: true });
    expect(await verifyRequest(await signedRequest())).toEqual({
      ok: false,
      reason: "network_error",
    });
  });

  test("never throws when an injected dependency fails unexpectedly", async () => {
    const client = publicClient();
    configureTap({
      now: () => {
        throw new Error("clock unavailable");
      },
      ensClient: client,
      paymentClient: client,
    });
    await expect(verifyRequest(await signedRequest())).resolves.toEqual({
      ok: false,
      reason: "network_error",
    });
  });
});

test("rejects every signed field changed after signing", async () => {
  configure();
  const original = encodeRequestUrl(await signedRequest());

  for (const field of ["m", "n", "t", "a", "x", "k", "c"] as const) {
    const tampered = decodeRequestUrl(tamperRequestUrl(original, field));
    const result = await verifyRequest(tampered);
    expect(result.ok, `${field} tamper must fail`).toBe(false);
  }
});

test("rejects malformed direct inputs without throwing", async () => {
  configure();
  const malformed = {
    chainId: PAYMENT_CHAIN_ID,
    request: {
      merchant: "not-an-address",
      token: DEFAULT_TOKEN,
      amount: 1n,
      nonce: "0x01",
      expiry: futureExpiry,
      merchantName: "e2e-merchant.tap.eth",
    },
    signature: "0x",
  } as unknown as SignedRequest;

  await expect(verifyRequest(malformed)).resolves.toEqual({ ok: false, reason: "malformed" });
});
