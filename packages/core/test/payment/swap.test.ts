import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  type Address,
  type Hash,
  type Hex,
  maxUint256,
  type PublicClient,
  type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { DEFAULT_TOKEN, PAYMENT_CHAIN_ID, paymentChains } from "../../src/config/chains";
import { configureTap } from "../../src/config/clients";
import { payWithSwap, quoteSwap } from "../../src/payment/swap";
import type { SignedRequest, SwapQuote } from "../../src/types";

const account = privateKeyToAccount(generatePrivateKey());
const tokenIn = "0x1111111111111111111111111111111111111111" as Address;
const approvalHash = `0x${"33".repeat(32)}` as Hash;
const paymentHash = `0x${"44".repeat(32)}` as Hash;
const signed: SignedRequest = {
  chainId: PAYMENT_CHAIN_ID,
  request: {
    merchant: "0x2222222222222222222222222222222222222222",
    token: DEFAULT_TOKEN,
    amount: 5_000_000n,
    nonce: `0x${"11".repeat(32)}` as Hex,
    expiry: 1_790_000_000n,
    merchantName: "yoyogi-market.tap.eth",
  },
  signature: `0x${"22".repeat(65)}` as Hex,
};

function nativeQuote(overrides: Partial<SwapQuote> = {}): SwapQuote {
  return {
    chainId: PAYMENT_CHAIN_ID,
    requestNonce: signed.request.nonce,
    inputKind: "native",
    tokenIn: paymentChains[PAYMENT_CHAIN_ID].swap.weth,
    tokenOut: DEFAULT_TOKEN,
    path: "0x1234",
    amountIn: 400n,
    amountInMaximum: 404n,
    amountOut: signed.request.amount,
    slippageBps: 100n,
    ...overrides,
  };
}

afterEach(() => configureTap());

describe("quoteSwap", () => {
  test("selects the cheapest exact-output pool and rounds the slippage cap up", async () => {
    const inputs = [500n, 450n, 400n, 600n];
    const simulateContract = mock(async () => ({ result: [inputs.shift(), [], [], 100_000n] }));
    configureTap({
      now: () => new Date("2026-01-01T00:00:00Z"),
      paymentClient: { simulateContract } as unknown as PublicClient,
    });

    const quote = await quoteSwap(signed, "native");

    expect(quote).toMatchObject({
      inputKind: "native",
      tokenIn: paymentChains[PAYMENT_CHAIN_ID].swap.weth,
      tokenOut: DEFAULT_TOKEN,
      amountIn: 400n,
      amountInMaximum: 404n,
      amountOut: signed.request.amount,
      slippageBps: 100n,
    });
    expect(simulateContract).toHaveBeenCalledTimes(4);
    expect(quote.path.toLowerCase()).toStartWith(DEFAULT_TOKEN.toLowerCase());
    expect(quote.path.toLowerCase()).toEndWith(
      paymentChains[PAYMENT_CHAIN_ID].swap.weth.slice(2).toLowerCase(),
    );
  });

  test("tries direct and WETH-bridged routes for an arbitrary ERC-20", async () => {
    const simulateContract = mock(async () => ({ result: [1_000n, [], [], 100_000n] }));
    configureTap({
      now: () => new Date("2026-01-01T00:00:00Z"),
      paymentClient: { simulateContract } as unknown as PublicClient,
    });

    const quote = await quoteSwap(signed, tokenIn, { slippageBps: 1n });

    expect(quote.inputKind).toBe("erc20");
    expect(quote.tokenIn).toBe(tokenIn);
    expect(quote.amountInMaximum).toBe(1_001n);
    expect(simulateContract).toHaveBeenCalledTimes(8);
  });

  test("fails closed when no route quotes and rejects settlement token input", async () => {
    configureTap({
      now: () => new Date("2026-01-01T00:00:00Z"),
      paymentClient: {
        simulateContract: mock(async () => {
          throw new Error("pool missing");
        }),
      } as unknown as PublicClient,
    });

    await expect(quoteSwap(signed, tokenIn)).rejects.toMatchObject({ code: "no_route" });
    await expect(quoteSwap(signed, DEFAULT_TOKEN)).rejects.toMatchObject({
      code: "invalid_token",
    });
    await expect(quoteSwap(signed, "native", { slippageBps: 2_001n })).rejects.toMatchObject({
      code: "invalid_slippage",
    });
  });
});

describe("payWithSwap", () => {
  test("binds a quote to the signed request before any network call", async () => {
    const getBalance = mock(async () => 1_000n);
    configureTap({
      now: () => new Date("2026-01-01T00:00:00Z"),
      paymentClient: { getBalance } as unknown as PublicClient,
    });

    await expect(
      payWithSwap(signed, account, nativeQuote({ requestNonce: `0x${"55".repeat(32)}` })),
    ).rejects.toMatchObject({ code: "invalid_quote" });
    await expect(
      payWithSwap(signed, account, nativeQuote({ amountInMaximum: 999n })),
    ).rejects.toMatchObject({ code: "invalid_quote" });
    expect(getBalance).not.toHaveBeenCalled();
  });

  test("simulates and sends native input with the maximum as msg.value", async () => {
    const simulateContract = mock(async (parameters: unknown) => ({ request: parameters }));
    const writeContract = mock(async () => paymentHash);
    configureTap({
      now: () => new Date("2026-01-01T00:00:00Z"),
      paymentClient: {
        getBalance: mock(async () => 1_000n),
        simulateContract,
      } as unknown as PublicClient,
      paymentWalletClient: { writeContract } as unknown as WalletClient,
    });

    await expect(payWithSwap(signed, account, nativeQuote())).resolves.toBe(paymentHash);
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: paymentChains[PAYMENT_CHAIN_ID].swap.adapter,
        functionName: "payWithNative",
        value: 404n,
      }),
    );
    expect(writeContract).toHaveBeenCalledTimes(1);
  });

  test("approves Permit2 once, signs a bounded permit, then submits the adapter call", async () => {
    let tokenAllowanceReads = 0;
    const readContract = mock(async (parameters: { address: Address; functionName: string }) => {
      if (parameters.address === tokenIn && parameters.functionName === "balanceOf") return 2_000n;
      if (parameters.address === tokenIn && parameters.functionName === "allowance") {
        tokenAllowanceReads += 1;
        return tokenAllowanceReads === 1 ? 0n : maxUint256;
      }
      if (
        parameters.address === paymentChains[PAYMENT_CHAIN_ID].swap.permit2 &&
        parameters.functionName === "allowance"
      ) {
        return [0n, 0, 7] as const;
      }
      throw new Error(`unexpected read: ${parameters.functionName}`);
    });
    const simulateContract = mock(
      async (parameters: {
        address: Address;
        functionName: string;
        args?: readonly unknown[];
      }) => ({
        request: parameters,
      }),
    );
    const writeContract = mock(async () =>
      writeContract.mock.calls.length === 1 ? approvalHash : paymentHash,
    );
    configureTap({
      now: () => new Date("2026-01-01T00:00:00Z"),
      paymentClient: {
        readContract,
        simulateContract,
        waitForTransactionReceipt: mock(async () => ({ status: "success" as const })),
      } as unknown as PublicClient,
      paymentWalletClient: { writeContract } as unknown as WalletClient,
    });

    const quote: SwapQuote = {
      ...nativeQuote(),
      inputKind: "erc20",
      tokenIn,
      path: "0xabcd",
    };
    await expect(payWithSwap(signed, account, quote)).resolves.toBe(paymentHash);

    expect(simulateContract.mock.calls[0]?.[0]).toMatchObject({
      address: tokenIn,
      functionName: "approve",
      args: [paymentChains[PAYMENT_CHAIN_ID].swap.permit2, maxUint256],
    });
    const paymentCall = simulateContract.mock.calls[1]?.[0];
    expect(paymentCall).toMatchObject({
      address: paymentChains[PAYMENT_CHAIN_ID].swap.adapter,
      functionName: "payWithToken",
    });
    expect(paymentCall?.args?.[5]).toMatchObject({
      details: { token: tokenIn, amount: 404n, expiration: 1_790_000_000, nonce: 7 },
      spender: paymentChains[PAYMENT_CHAIN_ID].swap.adapter,
      sigDeadline: signed.request.expiry,
    });
    expect(writeContract).toHaveBeenCalledTimes(2);
  });
});
