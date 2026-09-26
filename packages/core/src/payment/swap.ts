import {
  type Address,
  concatHex,
  getAddress,
  type Hash,
  type Hex,
  isAddressEqual,
  type LocalAccount,
  maxUint256,
  parseAbi,
  toHex,
  zeroAddress,
} from "viem";
import { tapSwapPayAbi } from "../config/abi";
import { getPaymentClient, getPaymentWalletClient } from "../config/clients";
import { TapPayError } from "../errors";
import { safeInteger } from "../integer";
import type { SignedRequest, SwapInput, SwapQuote } from "../types";
import { mapPaymentError, validateSettlement, waitForAllowance } from "./pay";

const BPS_SCALE = 10_000n;
const DEFAULT_SLIPPAGE_BPS = 100n;
const MAX_SLIPPAGE_BPS = 2_000n;
const MAX_UINT48 = (1n << 48n) - 1n;
const MAX_UINT160 = (1n << 160n) - 1n;

const quoterAbi = parseAbi([
  "function quoteExactOutput(bytes path, uint256 amountOut) returns (uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
]);

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const permit2Abi = parseAbi([
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
]);

const PERMIT2_TYPES = {
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
} as const;

function encodePath(tokens: readonly Address[], fees: readonly number[]): Hex {
  const firstToken = tokens[0];
  if (!firstToken || tokens.length !== fees.length + 1) {
    throw new TapPayError("invalid_route", "Swap route is malformed");
  }
  const parts: Hex[] = [firstToken];
  for (let index = 0; index < fees.length; index += 1) {
    const fee = fees[index];
    const token = tokens[index + 1];
    if (fee === undefined || token === undefined) {
      throw new TapPayError("invalid_route", "Swap route is malformed");
    }
    parts.push(toHex(fee, { size: 3 }), token);
  }
  return concatHex(parts);
}

function routeCandidates(
  tokenOut: Address,
  tokenIn: Address,
  weth: Address,
  feeTiers: readonly number[],
): Hex[] {
  const direct = feeTiers.map((fee) => encodePath([tokenOut, tokenIn], [fee]));
  if (isAddressEqual(tokenIn, weth)) return direct;

  const bridgeFees = feeTiers.filter((fee) => fee === 500 || fee === 3_000);
  const bridged = bridgeFees.flatMap((outputFee) =>
    bridgeFees.map((inputFee) => encodePath([tokenOut, weth, tokenIn], [outputFee, inputFee])),
  );
  return [...direct, ...bridged];
}

function maximumInput(amountIn: bigint, slippageBps: bigint): bigint {
  return (amountIn * (BPS_SCALE + slippageBps) + BPS_SCALE - 1n) / BPS_SCALE;
}

function assertQuote(signed: SignedRequest, quote: SwapQuote): void {
  if (
    quote.chainId !== signed.chainId ||
    quote.requestNonce !== signed.request.nonce ||
    !isAddressEqual(quote.tokenOut, signed.request.token) ||
    quote.amountOut !== signed.request.amount ||
    quote.amountIn <= 0n ||
    quote.slippageBps < 0n ||
    quote.slippageBps > MAX_SLIPPAGE_BPS ||
    quote.amountInMaximum !== maximumInput(quote.amountIn, quote.slippageBps) ||
    quote.amountInMaximum > MAX_UINT160
  ) {
    throw new TapPayError("invalid_quote", "Swap quote does not match the payment request");
  }
}

export async function quoteSwap(
  signed: SignedRequest,
  input: SwapInput,
  options: { slippageBps?: bigint } = {},
): Promise<SwapQuote> {
  const chain = validateSettlement(signed);
  const slippageBps = options.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  if (slippageBps < 0n || slippageBps > MAX_SLIPPAGE_BPS) {
    throw new TapPayError("invalid_slippage", "Slippage must be between 0 and 2000 bps");
  }

  let inputKind: SwapQuote["inputKind"];
  let tokenIn: Address;
  try {
    inputKind = input === "native" ? "native" : "erc20";
    tokenIn = input === "native" ? chain.swap.weth : getAddress(input);
  } catch (cause) {
    throw new TapPayError("invalid_token", "Input token address is invalid", { cause });
  }
  if (isAddressEqual(tokenIn, zeroAddress) || isAddressEqual(tokenIn, signed.request.token)) {
    throw new TapPayError("invalid_token", "Use direct payment for the settlement token");
  }

  const client = getPaymentClient();
  const paths = routeCandidates(
    signed.request.token,
    tokenIn,
    chain.swap.weth,
    chain.swap.feeTiers,
  );
  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        const { result } = await client.simulateContract({
          address: chain.swap.quoter,
          abi: quoterAbi,
          functionName: "quoteExactOutput",
          args: [path, signed.request.amount],
        });
        return { path, amountIn: result[0] };
      } catch {
        return null;
      }
    }),
  );
  const best = results
    .filter((result): result is { path: Hex; amountIn: bigint } => result !== null)
    .reduce<{ path: Hex; amountIn: bigint } | null>(
      (current, result) => (!current || result.amountIn < current.amountIn ? result : current),
      null,
    );
  if (!best || best.amountIn <= 0n) {
    throw new TapPayError("no_route", "No liquid Uniswap route is available for this token");
  }

  const amountInMaximum = maximumInput(best.amountIn, slippageBps);
  if (amountInMaximum > MAX_UINT160) {
    throw new TapPayError("invalid_quote", "Quoted input exceeds Permit2 limits");
  }
  return {
    chainId: signed.chainId,
    requestNonce: signed.request.nonce,
    inputKind,
    tokenIn,
    tokenOut: signed.request.token,
    path: best.path,
    amountIn: best.amountIn,
    amountInMaximum,
    amountOut: signed.request.amount,
    slippageBps,
  };
}

async function payWithNativeSwap(
  signed: SignedRequest,
  account: LocalAccount,
  quote: SwapQuote,
): Promise<Hash> {
  const chain = validateSettlement(signed);
  if (quote.inputKind !== "native" || !isAddressEqual(quote.tokenIn, chain.swap.weth)) {
    throw new TapPayError("invalid_quote", "Native quote is invalid");
  }
  const client = getPaymentClient();
  const balance = await client.getBalance({ address: account.address });
  if (balance < quote.amountInMaximum) {
    throw new TapPayError("insufficient_funds", "ETH balance is below the maximum input");
  }
  const { request } = await client.simulateContract({
    address: chain.swap.adapter,
    abi: tapSwapPayAbi,
    functionName: "payWithNative",
    args: [signed.request, signed.signature, quote.amountInMaximum, quote.path],
    account,
    value: quote.amountInMaximum,
  });
  return getPaymentWalletClient(account).writeContract(request);
}

async function payWithTokenSwap(
  signed: SignedRequest,
  account: LocalAccount,
  quote: SwapQuote,
): Promise<Hash> {
  const chain = validateSettlement(signed);
  if (quote.inputKind !== "erc20") {
    throw new TapPayError("invalid_quote", "Token quote is invalid");
  }
  if (signed.request.expiry > MAX_UINT48) {
    throw new TapPayError("invalid_quote", "Payment expiry exceeds Permit2 limits");
  }

  const client = getPaymentClient();
  const contract = { address: quote.tokenIn, abi: erc20Abi } as const;
  const [balance, tokenAllowance] = await Promise.all([
    client.readContract({ ...contract, functionName: "balanceOf", args: [account.address] }),
    client.readContract({
      ...contract,
      functionName: "allowance",
      args: [account.address, chain.swap.permit2],
    }),
  ]);
  if (balance < quote.amountInMaximum) {
    throw new TapPayError("insufficient_funds", "Token balance is below the maximum input");
  }

  const wallet = getPaymentWalletClient(account);
  if (tokenAllowance < quote.amountInMaximum) {
    const { request: approval } = await client.simulateContract({
      ...contract,
      functionName: "approve",
      args: [chain.swap.permit2, maxUint256],
      account,
    });
    const approvalHash = await wallet.writeContract(approval);
    const receipt = await client.waitForTransactionReceipt({
      hash: approvalHash,
      confirmations: 1,
    });
    if (receipt.status !== "success") {
      throw new TapPayError("unknown", "Permit2 token approval reverted");
    }
    await waitForAllowance(
      client,
      quote.tokenIn,
      account.address,
      chain.swap.permit2,
      quote.amountInMaximum,
    );
  }

  const [, , nonce] = await client.readContract({
    address: chain.swap.permit2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [account.address, quote.tokenIn, chain.swap.adapter],
  });
  const permitSingle = {
    details: {
      token: quote.tokenIn,
      amount: quote.amountInMaximum,
      expiration: safeInteger(signed.request.expiry),
      nonce,
    },
    spender: chain.swap.adapter,
    sigDeadline: signed.request.expiry,
  } as const;
  const permitSignature = await account.signTypedData({
    domain: {
      name: "Permit2",
      chainId: signed.chainId,
      verifyingContract: chain.swap.permit2,
    },
    types: PERMIT2_TYPES,
    primaryType: "PermitSingle",
    message: permitSingle,
  });
  const { request } = await client.simulateContract({
    address: chain.swap.adapter,
    abi: tapSwapPayAbi,
    functionName: "payWithToken",
    args: [
      signed.request,
      signed.signature,
      quote.tokenIn,
      quote.amountInMaximum,
      quote.path,
      permitSingle,
      permitSignature,
    ],
    account,
  });
  return wallet.writeContract(request);
}

export async function payWithSwap(
  signed: SignedRequest,
  account: LocalAccount,
  quote: SwapQuote,
): Promise<Hash> {
  try {
    validateSettlement(signed);
    assertQuote(signed, quote);
    return quote.inputKind === "native"
      ? await payWithNativeSwap(signed, account, quote)
      : await payWithTokenSwap(signed, account, quote);
  } catch (error) {
    throw mapPaymentError(error);
  }
}
