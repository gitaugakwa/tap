import { isAddress, isAddressEqual, isHex, recoverTypedDataAddress, size } from "viem";
import { normalize } from "viem/ens";
import { getPaymentChain, getTokenConfig } from "../config/chains";
import { getNow, getPaymentClient } from "../config/clients";
import { formatAmount } from "../format";
import { getTapPayDomain, PAYMENT_REQUEST_TYPES } from "../request/sign";
import type { SignedRequest, VerifyResult } from "../types";
import { getMerchantProfile, isUnderParent } from "./ens";

const MAX_UINT256 = (1n << 256n) - 1n;
const MAX_UINT64 = (1n << 64n) - 1n;
const MAX_DATE_SECONDS = 8_640_000_000_000n;

function hasValidShape(signed: SignedRequest): boolean {
  try {
    const { request } = signed;
    return (
      Number.isSafeInteger(signed.chainId) &&
      signed.chainId >= 0 &&
      isAddress(request.merchant) &&
      isAddress(request.token) &&
      typeof request.amount === "bigint" &&
      request.amount > 0n &&
      request.amount <= MAX_UINT256 &&
      typeof request.expiry === "bigint" &&
      request.expiry >= 0n &&
      request.expiry <= MAX_UINT64 &&
      request.expiry <= MAX_DATE_SECONDS &&
      typeof request.merchantName === "string" &&
      request.merchantName.length > 0 &&
      isHex(request.nonce) &&
      size(request.nonce) === 32 &&
      isHex(signed.signature) &&
      size(signed.signature) > 0
    );
  } catch {
    return false;
  }
}

async function hasValidSignature(signed: SignedRequest): Promise<boolean> {
  const typedData = {
    domain: getTapPayDomain(signed.chainId),
    types: PAYMENT_REQUEST_TYPES,
    primaryType: "PaymentRequest" as const,
    message: signed.request,
  };

  try {
    const recovered = await recoverTypedDataAddress({
      ...typedData,
      signature: signed.signature,
    });
    if (isAddressEqual(recovered, signed.request.merchant)) return true;
  } catch {
    // Contract signatures and malformed EOA signatures continue to ERC-1271 verification.
  }

  try {
    return await getPaymentClient().verifyTypedData({
      address: signed.request.merchant,
      ...typedData,
      signature: signed.signature,
    });
  } catch {
    return false;
  }
}

async function verifyRequestInternal(signed: SignedRequest): Promise<VerifyResult> {
  if (!hasValidShape(signed)) return { ok: false, reason: "malformed" };

  const chain = getPaymentChain(signed.chainId);
  if (!chain) return { ok: false, reason: "unknown_chain" };

  const token = getTokenConfig(signed.chainId, signed.request.token);
  if (!token) return { ok: false, reason: "unknown_token" };

  const now = BigInt(Math.floor(getNow().getTime() / 1_000));
  if (now >= signed.request.expiry) return { ok: false, reason: "expired" };

  if (!(await hasValidSignature(signed))) return { ok: false, reason: "bad_signature" };
  if (!isUnderParent(signed.request.merchantName)) {
    return { ok: false, reason: "not_under_parent" };
  }

  try {
    const ensName = normalize(signed.request.merchantName);
    const profile = await getMerchantProfile(ensName);
    if (profile.address === null) return { ok: false, reason: "ens_unresolved" };
    if (!isAddressEqual(profile.address, signed.request.merchant)) {
      return { ok: false, reason: "ens_mismatch" };
    }

    return {
      ok: true,
      ensName,
      displayName: profile.displayName,
      tokenSymbol: token.symbol,
      displayAmount: formatAmount(signed.request.amount, token.address),
      expiresAt: new Date(Number(signed.request.expiry) * 1_000),
    };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

export async function verifyRequest(signed: SignedRequest): Promise<VerifyResult> {
  try {
    return await verifyRequestInternal(signed);
  } catch {
    return { ok: false, reason: "network_error" };
  }
}
