import {
  type Address,
  BaseError,
  ContractFunctionRevertedError,
  type Hash,
  type Hex,
  InsufficientFundsError,
  type LocalAccount,
  parseAbi,
} from "viem";
import { tapPayAbi } from "../config/abi";
import { getPaymentChain, getTokenConfig, PAYMENT_CHAIN_ID } from "../config/chains";
import { getNow, getPaymentClient, getPaymentWalletClient } from "../config/clients";
import { TapPayError } from "../errors";
import type { SignedRequest } from "../types";
import { signPermit } from "./permit";

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const revertCodes = {
  Expired: "expired",
  NonceUsed: "already_paid",
  BadSignature: "bad_signature",
  ZeroAmount: "invalid_amount",
  ERC20InsufficientBalance: "insufficient_funds",
  SafeERC20FailedOperation: "insufficient_funds",
} as const;

export function mapPaymentError(error: unknown): TapPayError {
  if (error instanceof TapPayError) return error;

  if (error instanceof BaseError) {
    const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName as keyof typeof revertCodes | undefined;
      const code = name ? revertCodes[name] : undefined;
      if (code) return new TapPayError(code, "Payment was rejected", { cause: error });
      return new TapPayError("unknown", "Payment was rejected", { cause: error });
    }

    const insufficientGas = error.walk((cause) => cause instanceof InsufficientFundsError);
    if (insufficientGas) {
      return new TapPayError("insufficient_gas", "Not enough ETH for gas", { cause: error });
    }

    return new TapPayError("network", "Payment network request failed", { cause: error });
  }

  return new TapPayError("unknown", "Payment failed", {
    cause: error instanceof Error ? error : undefined,
  });
}

function settlementConfig(signed: SignedRequest) {
  const chain = getPaymentChain(signed.chainId);
  if (!chain) throw new TapPayError("unknown_chain", "Payment chain is not supported");
  if (!getTokenConfig(signed.chainId, signed.request.token)) {
    throw new TapPayError("unknown_token", "Payment token is not supported");
  }
  if (signed.request.amount <= 0n) {
    throw new TapPayError("invalid_amount", "Payment amount must be positive");
  }
  const now = BigInt(Math.floor(getNow().getTime() / 1_000));
  if (now >= signed.request.expiry) {
    throw new TapPayError("expired", "Payment request has expired");
  }
  return chain;
}

async function assertFunds(signed: SignedRequest, owner: Address): Promise<void> {
  const balance = await getPaymentClient().readContract({
    address: signed.request.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
  if (balance < signed.request.amount) {
    throw new TapPayError("insufficient_funds", "Token balance is below the payment amount");
  }
}

export async function payWithPermit(signed: SignedRequest, account: LocalAccount): Promise<Hash> {
  try {
    const chain = settlementConfig(signed);
    await assertFunds(signed, account.address);
    const permit = await signPermit(signed, account);
    const client = getPaymentClient();
    const { request } = await client.simulateContract({
      address: chain.tapPay,
      abi: tapPayAbi,
      functionName: "payWithPermit",
      args: [signed.request, signed.signature, permit.deadline, permit.v, permit.r, permit.s],
      account,
    });
    return await getPaymentWalletClient(account).writeContract(request);
  } catch (error) {
    throw mapPaymentError(error);
  }
}

export function pay(_signed: SignedRequest, _account: LocalAccount): Promise<Hash> {
  throw new Error("not implemented: pay");
}

export async function waitForPayment(hash: Hash): Promise<"success" | "reverted"> {
  const receipt = await getPaymentClient().waitForTransactionReceipt({ hash, confirmations: 1 });
  return receipt.status;
}

export async function isPaid(merchant: Address, nonce: Hex): Promise<boolean> {
  const chain = getPaymentChain(PAYMENT_CHAIN_ID);
  if (!chain) throw new TapPayError("unknown_chain", "Payment chain is not supported");
  return getPaymentClient().readContract({
    address: chain.tapPay,
    abi: tapPayAbi,
    functionName: "isPaid",
    args: [merchant, nonce],
  });
}
