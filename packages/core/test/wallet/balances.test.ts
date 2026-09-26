import { afterEach, describe, expect, mock, test } from "bun:test";
import type { PublicClient } from "viem";
import { DEFAULT_TOKEN } from "../../src/config/chains";
import { configureTap } from "../../src/config/clients";
import { getWalletBalances } from "../../src/wallet/balances";

const address = "0x1111111111111111111111111111111111111111" as const;

afterEach(() => configureTap());

describe("getWalletBalances", () => {
  test("returns Base Sepolia ETH and every allowlisted token", async () => {
    const getBalance = mock(async () => 50_000_000_000_000_000n);
    const readContract = mock(async (_parameters: unknown) => 12_340_000n);
    configureTap({
      paymentClient: { getBalance, readContract } as unknown as PublicClient,
    });

    await expect(getWalletBalances(address)).resolves.toEqual({
      gas: { symbol: "ETH", amount: 50_000_000_000_000_000n, display: "0.05" },
      tokens: [
        {
          address: DEFAULT_TOKEN,
          symbol: "USDC",
          amount: 12_340_000n,
          display: "$12.34",
        },
      ],
    });
    expect(getBalance).toHaveBeenCalledWith({ address });
    expect(readContract.mock.calls[0]?.[0]).toMatchObject({
      address: DEFAULT_TOKEN,
      functionName: "balanceOf",
      args: [address],
    });
  });
});
