import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  type Address,
  type Hash,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
  zeroAddress,
} from "viem";
import { configureTap } from "../../src/config/clients";
import {
  checkMerchantSetup,
  getMerchantProfile,
  isMerchantLabelAvailable,
  isUnderParent,
  registerMerchant,
  resolveMerchant,
} from "../../src/verify/ens";

const merchant = "0x1111111111111111111111111111111111111111" as Address;
const stranger = "0x2222222222222222222222222222222222222222" as Address;
const transaction = `0x${"a".repeat(64)}` as Hash;
const account = { address: merchant } as LocalAccount;

function ensClient(options: {
  address?: Address | null;
  displayName?: string | null;
  fail?: boolean;
  onAddress?: (name: string) => void;
  onText?: (name: string, key: string) => void;
}): PublicClient {
  return {
    async getEnsAddress({ name }) {
      options.onAddress?.(name);
      if (options.fail) throw new Error("RPC unavailable");
      return options.address ?? null;
    },
    async getEnsText({ name, key }) {
      options.onText?.(name, key);
      if (options.fail) throw new Error("RPC unavailable");
      return options.displayName ?? null;
    },
  } as PublicClient;
}

afterEach(() => configureTap());

describe("isUnderParent", () => {
  test.each([
    "yoyogi-market.tap.eth",
    "YOYOGI-MARKET.tap.eth",
    "abc.tap.eth",
    `${"a".repeat(32)}.tap.eth`,
  ])("accepts direct merchant name %s", (name) => expect(isUnderParent(name)).toBe(true));

  test.each([
    "tap.eth",
    "ab.tap.eth",
    `${"a".repeat(33)}.tap.eth`,
    "evil-tap.eth",
    "x.tap.eth.evil.eth",
    "a.b.tap.eth",
    "yoyogi-market.eth",
    "-abc.tap.eth",
    "abc-.tap.eth",
    "ábc.tap.eth",
    "abc_.tap.eth",
    "",
  ])("rejects untrusted name %s", (name) => expect(isUnderParent(name)).toBe(false));
});

test("resolveMerchant normalizes names and rejects the zero address", async () => {
  const seen: string[] = [];
  configureTap({
    ensClient: ensClient({ address: zeroAddress, onAddress: (name) => seen.push(name) }),
  });

  expect(await resolveMerchant("YOYOGI-MARKET.tap.eth")).toBeNull();
  expect(seen).toEqual(["yoyogi-market.tap.eth"]);

  configureTap({ ensClient: ensClient({ address: merchant }) });
  expect(await resolveMerchant("yoyogi-market.tap.eth")).toBe(merchant);
});

test("getMerchantProfile reads address and display name from ENS", async () => {
  const calls: string[] = [];
  configureTap({
    ensClient: ensClient({
      address: merchant,
      displayName: "Takoyaki Stand",
      onAddress: (name) => calls.push(`address:${name}`),
      onText: (name, key) => calls.push(`text:${name}:${key}`),
    }),
  });

  await expect(getMerchantProfile("YOYOGI-MARKET.tap.eth")).resolves.toEqual({
    address: merchant,
    displayName: "Takoyaki Stand",
  });
  expect(calls).toContain("address:yoyogi-market.tap.eth");
  expect(calls).toContain("text:yoyogi-market.tap.eth:name");
});

describe("checkMerchantSetup", () => {
  test("returns the live display name when name and address match", async () => {
    configureTap({ ensClient: ensClient({ address: merchant, displayName: "Takoyaki Stand" }) });
    await expect(checkMerchantSetup("yoyogi-market.tap.eth", merchant)).resolves.toEqual({
      ok: true,
      displayName: "Takoyaki Stand",
    });
  });

  test("fails closed for namespace, resolution, mismatch, and network failures", async () => {
    expect(await checkMerchantSetup("merchant.eth", merchant)).toEqual({
      ok: false,
      reason: "not_under_parent",
    });

    configureTap({ ensClient: ensClient({ address: null }) });
    expect(await checkMerchantSetup("yoyogi-market.tap.eth", merchant)).toEqual({
      ok: false,
      reason: "ens_unresolved",
    });

    configureTap({ ensClient: ensClient({ address: stranger }) });
    expect(await checkMerchantSetup("yoyogi-market.tap.eth", merchant)).toEqual({
      ok: false,
      reason: "ens_mismatch",
    });

    configureTap({ ensClient: ensClient({ fail: true }) });
    expect(await checkMerchantSetup("yoyogi-market.tap.eth", merchant)).toEqual({
      ok: false,
      reason: "network_error",
    });
  });
});

describe("merchant registration", () => {
  test("checks availability through the configured registrar client", async () => {
    const readContract = mock(async (_request: unknown) => true);
    configureTap({ ensClient: { readContract } as unknown as PublicClient });

    await expect(isMerchantLabelAvailable("yoyogi-market")).resolves.toBe(true);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract.mock.calls[0]?.[0]).toMatchObject({
      functionName: "isAvailable",
      args: ["yoyogi-market"],
    });
  });

  test.each(["ab", "Uppercase", "-edge", "edge-", "has space", "a".repeat(33)])(
    "rejects invalid label %s before an RPC call",
    async (label) => {
      const readContract = mock(async (_request: unknown) => true);
      configureTap({ ensClient: { readContract } as unknown as PublicClient });

      await expect(isMerchantLabelAvailable(label)).rejects.toMatchObject({
        code: "invalid_label",
      });
      expect(readContract).not.toHaveBeenCalled();
    },
  );

  test("simulates, sends, and confirms a registration", async () => {
    const request = { test: "registration request" };
    const readContract = mock(async (_request: unknown) => true);
    const simulateContract = mock(async (_request: unknown) => ({ request }));
    const waitForTransactionReceipt = mock(async () => ({ status: "success" as const }));
    const writeContract = mock(async () => transaction);
    configureTap({
      ensClient: {
        readContract,
        simulateContract,
        waitForTransactionReceipt,
      } as unknown as PublicClient,
      ensWalletClient: { writeContract } as unknown as WalletClient,
    });

    await expect(
      registerMerchant(
        { label: "yoyogi-market", displayName: "Yoyogi Market", owner: merchant },
        account,
      ),
    ).resolves.toBe(transaction);
    expect(simulateContract.mock.calls[0]?.[0]).toMatchObject({
      functionName: "register",
      args: ["yoyogi-market", merchant, "Yoyogi Market"],
      account,
    });
    expect(writeContract).toHaveBeenCalledWith(request);
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: transaction,
      confirmations: 1,
    });
  });

  test("rejects a taken name before simulation", async () => {
    const simulateContract = mock(async (_request: unknown) => ({ request: {} }));
    configureTap({
      ensClient: {
        readContract: async () => false,
        simulateContract,
      } as unknown as PublicClient,
    });

    await expect(
      registerMerchant(
        { label: "yoyogi-market", displayName: "Yoyogi Market", owner: merchant },
        account,
      ),
    ).rejects.toMatchObject({ code: "name_taken" });
    expect(simulateContract).not.toHaveBeenCalled();
  });

  test("rejects owner mismatch and invalid display names before an RPC call", async () => {
    const readContract = mock(async (_request: unknown) => true);
    configureTap({ ensClient: { readContract } as unknown as PublicClient });

    await expect(
      registerMerchant(
        { label: "yoyogi-market", displayName: "Yoyogi Market", owner: stranger },
        account,
      ),
    ).rejects.toMatchObject({ code: "owner_mismatch" });
    await expect(
      registerMerchant({ label: "yoyogi-market", displayName: "", owner: merchant }, account),
    ).rejects.toMatchObject({ code: "invalid_display_name" });
    await expect(
      registerMerchant(
        { label: "yoyogi-market", displayName: "é".repeat(33), owner: merchant },
        account,
      ),
    ).rejects.toMatchObject({ code: "invalid_display_name" });
    expect(readContract).not.toHaveBeenCalled();
  });

  test("reports a reverted confirmed transaction", async () => {
    configureTap({
      ensClient: {
        readContract: async () => true,
        simulateContract: async () => ({ request: {} }),
        waitForTransactionReceipt: async () => ({ status: "reverted" }),
      } as unknown as PublicClient,
      ensWalletClient: {
        writeContract: async () => transaction,
      } as unknown as WalletClient,
    });

    await expect(
      registerMerchant(
        { label: "yoyogi-market", displayName: "Yoyogi Market", owner: merchant },
        account,
      ),
    ).rejects.toMatchObject({ code: "registration_reverted" });
  });
});
