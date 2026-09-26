import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  type Hash,
  type Hex,
  InsufficientFundsError,
  type PublicClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { tapPayAbi } from "../../src/config/abi";
import { DEFAULT_TOKEN, PAYMENT_CHAIN_ID } from "../../src/config/chains";
import { configureTap } from "../../src/config/clients";
import { TapPayError } from "../../src/errors";
import {
  isPaid,
  mapPaymentError,
  payWithPermit,
  waitForAllowance,
  waitForPayment,
} from "../../src/payment/pay";
import type { SignedRequest } from "../../src/types";

const account = privateKeyToAccount(generatePrivateKey());
const transactionHash = `0x${"33".repeat(32)}` as Hash;
const signed: SignedRequest = {
  chainId: PAYMENT_CHAIN_ID,
  request: {
    merchant: "0x1111111111111111111111111111111111111111",
    token: DEFAULT_TOKEN,
    amount: 5_000_000n,
    nonce: `0x${"11".repeat(32)}` as Hex,
    expiry: 1_790_000_000n,
    merchantName: "yoyogi-market.tap.eth",
  },
  signature: `0x${"22".repeat(65)}` as Hex,
};

afterEach(() => configureTap());

describe("payment prechecks", () => {
  test("rejects unsupported, expired and zero-value requests before simulation", async () => {
    configureTap({ now: () => new Date("2026-01-01T00:00:00Z") });

    await expect(payWithPermit({ ...signed, chainId: 1 }, account)).rejects.toMatchObject({
      code: "unknown_chain",
    });
    await expect(
      payWithPermit(
        {
          ...signed,
          request: {
            ...signed.request,
            token: "0x2222222222222222222222222222222222222222",
          },
        },
        account,
      ),
    ).rejects.toMatchObject({ code: "unknown_token" });
    await expect(
      payWithPermit({ ...signed, request: { ...signed.request, amount: 0n } }, account),
    ).rejects.toMatchObject({ code: "invalid_amount" });
    await expect(
      payWithPermit({ ...signed, request: { ...signed.request, expiry: 1n } }, account),
    ).rejects.toMatchObject({ code: "expired" });
  });

  test("checks the token balance before signing or simulating", async () => {
    const readContract = mock(async () => 4_999_999n);
    configureTap({
      now: () => new Date("2026-01-01T00:00:00Z"),
      paymentClient: { readContract } as unknown as PublicClient,
    });

    await expect(payWithPermit(signed, account)).rejects.toMatchObject({
      code: "insufficient_funds",
    });
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  test("waits until a confirmed approval is visible through the RPC", async () => {
    const readContract = mock(async () =>
      readContract.mock.calls.length === 1 ? 0n : signed.request.amount,
    );

    await expect(
      waitForAllowance(
        { readContract } as unknown as PublicClient,
        signed.request.token,
        account.address,
        "0x3333333333333333333333333333333333333333",
        signed.request.amount,
      ),
    ).resolves.toBeUndefined();
    expect(readContract).toHaveBeenCalledTimes(2);
  });
});

describe("payment error mapping", () => {
  test.each([
    ["Expired", "expired"],
    ["NonceUsed", "already_paid"],
    ["BadSignature", "bad_signature"],
    ["ZeroAmount", "invalid_amount"],
  ] as const)("maps %s to %s", (errorName, code) => {
    const reverted = new ContractFunctionRevertedError({
      abi: tapPayAbi,
      data: encodeErrorResult({ abi: tapPayAbi, errorName }),
      functionName: "pay",
    });
    const mapped = mapPaymentError(new BaseError("simulation failed", { cause: reverted }));

    expect(mapped).toBeInstanceOf(TapPayError);
    expect(mapped.code).toBe(code);
  });

  test("maps viem transport failures to network and unknown errors conservatively", () => {
    const unknownRevert = new ContractFunctionRevertedError({
      abi: tapPayAbi,
      functionName: "pay",
      message: "execution reverted",
    });

    expect(mapPaymentError(new BaseError("RPC unavailable")).code).toBe("network");
    expect(
      mapPaymentError(new BaseError("send failed", { cause: new InsufficientFundsError() })).code,
    ).toBe("insufficient_gas");
    expect(mapPaymentError(new BaseError("simulation failed", { cause: unknownRevert })).code).toBe(
      "unknown",
    );
    expect(mapPaymentError(new Error("unexpected")).code).toBe("unknown");
  });
});

describe("payment status", () => {
  test("waits for one confirmation and returns the receipt status", async () => {
    const waitForTransactionReceipt = mock(async () => ({ status: "success" as const }));
    configureTap({
      paymentClient: { waitForTransactionReceipt } as unknown as PublicClient,
    });

    await expect(waitForPayment(transactionHash)).resolves.toBe("success");
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: transactionHash,
      confirmations: 1,
    });
  });

  test("reads settlement state from the allowlisted TapPay contract", async () => {
    const readContract = mock(async (_parameters: unknown) => true);
    configureTap({ paymentClient: { readContract } as unknown as PublicClient });

    await expect(isPaid(signed.request.merchant, signed.request.nonce)).resolves.toBe(true);
    expect(readContract.mock.calls[0]?.[0]).toMatchObject({
      functionName: "isPaid",
      args: [signed.request.merchant, signed.request.nonce],
    });
  });
});
