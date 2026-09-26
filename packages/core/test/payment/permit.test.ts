import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  type Address,
  type Hex,
  type PublicClient,
  recoverTypedDataAddress,
  serializeSignature,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { DEFAULT_TOKEN, PAYMENT_CHAIN_ID, paymentChains } from "../../src/config/chains";
import { configureTap } from "../../src/config/clients";
import { TapPayError } from "../../src/errors";
import { signPermit } from "../../src/payment/permit";
import type { SignedRequest } from "../../src/types";

const account = privateKeyToAccount(generatePrivateKey());
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

describe("signPermit", () => {
  test("reads the token domain and signs the exact settlement allowance", async () => {
    const readContract = mock(async ({ functionName }: { functionName: string }) => {
      if (functionName === "name") return "USD Coin";
      if (functionName === "version") return "2";
      if (functionName === "nonces") return 7n;
      throw new Error(`unexpected function: ${functionName}`);
    });
    configureTap({ paymentClient: { readContract } as unknown as PublicClient });

    const permit = await signPermit(signed, account);
    const recovered = await recoverTypedDataAddress({
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: PAYMENT_CHAIN_ID,
        verifyingContract: DEFAULT_TOKEN,
      },
      types: {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Permit",
      message: {
        owner: account.address,
        spender: paymentChains[PAYMENT_CHAIN_ID].tapPay,
        value: signed.request.amount,
        nonce: 7n,
        deadline: signed.request.expiry,
      },
      signature: serializeSignature({ v: BigInt(permit.v), r: permit.r, s: permit.s }),
    });

    expect(recovered).toBe(account.address);
    expect(permit.deadline).toBe(signed.request.expiry);
    expect(readContract).toHaveBeenCalledTimes(3);
    expect(
      readContract.mock.calls.find(([call]) => call.functionName === "nonces")?.[0],
    ).toMatchObject({
      address: DEFAULT_TOKEN,
      args: [account.address],
    });
  });

  test("rejects unknown chains and tokens before reading the network", async () => {
    await expect(signPermit({ ...signed, chainId: 1 }, account)).rejects.toMatchObject({
      code: "unknown_chain",
    });
    await expect(
      signPermit(
        {
          ...signed,
          request: {
            ...signed.request,
            token: "0x2222222222222222222222222222222222222222" as Address,
          },
        },
        account,
      ),
    ).rejects.toBeInstanceOf(TapPayError);
  });
});
