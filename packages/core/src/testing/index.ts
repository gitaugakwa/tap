import {
  type Address,
  getAddress,
  type Hash,
  type Hex,
  isAddress,
  isHex,
  type LocalAccount,
  size,
  toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { normalize } from "viem/ens";
import { DEFAULT_TOKEN, PAYMENT_CHAIN_ID, paymentChains } from "../config/chains";
import { REQUEST_TTL_SECONDS, REQUEST_URL_BASE } from "../config/constants";
import { TapDecodeError } from "../errors";
import { PAYMENT_REQUEST_TYPES } from "../request/sign";
import type { PaymentRequest, SignedRequest, VerifyResult } from "../types";

export type TamperField = "m" | "n" | "t" | "a" | "x" | "k" | "c";

export type TapCoreLike = {
  newChargeRequest(options: {
    merchant: Address;
    merchantName: string;
    amount: bigint;
    token?: Address;
  }): PaymentRequest;
  signRequest(request: PaymentRequest, account: LocalAccount): Promise<SignedRequest>;
  encodeRequestUrl(signed: SignedRequest): string;
  decodeRequestUrl(url: string): SignedRequest;
  verifyRequest(signed: SignedRequest): Promise<VerifyResult>;
  payWithPermit(signed: SignedRequest, account: LocalAccount): Promise<Hash>;
  waitForPayment(hash: Hash): Promise<"success" | "reverted">;
  watchPaid(merchant: Address, nonce: Hex, onPaid: (transaction: Hash | null) => void): () => void;
};

export const fakeMerchantAccount = privateKeyToAccount(generatePrivateKey());

export const fakeRequest: PaymentRequest = {
  merchant: fakeMerchantAccount.address,
  token: DEFAULT_TOKEN,
  amount: 5_000_000n,
  nonce: toHex(new Uint8Array(32).fill(1)),
  expiry: 4_102_444_800n,
  merchantName: "yoyogi-market.tap.eth",
};

function createRequest(options: {
  merchant: Address;
  merchantName: string;
  amount: bigint;
  token?: Address;
}): PaymentRequest {
  return {
    merchant: options.merchant,
    token: options.token ?? DEFAULT_TOKEN,
    amount: options.amount,
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
    expiry: BigInt(Math.floor(Date.now() / 1000) + REQUEST_TTL_SECONDS),
    merchantName: normalize(options.merchantName),
  };
}

async function sign(request: PaymentRequest, account: LocalAccount): Promise<SignedRequest> {
  const signature = await account.signTypedData({
    domain: {
      name: "TapPay",
      version: "1",
      chainId: PAYMENT_CHAIN_ID,
      verifyingContract: paymentChains[PAYMENT_CHAIN_ID].tapPay,
    },
    types: PAYMENT_REQUEST_TYPES,
    primaryType: "PaymentRequest",
    message: request,
  });
  return { chainId: PAYMENT_CHAIN_ID, request, signature };
}

function encode(signed: SignedRequest): string {
  const { request } = signed;
  return `${REQUEST_URL_BASE}?v=1&c=${signed.chainId}&m=${request.merchant}&n=${encodeURIComponent(request.merchantName)}&t=${request.token}&a=${request.amount}&x=${request.expiry}&k=${request.nonce}&s=${signed.signature}`;
}

function decode(url: string): SignedRequest {
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== "/p") throw new Error("wrong path");
    const required = ["v", "c", "m", "n", "t", "a", "x", "k", "s"] as const;
    const values = Object.fromEntries(
      required.map((key) => {
        const entries = parsed.searchParams.getAll(key);
        if (entries.length !== 1 || entries[0] === "") throw new Error(`invalid ${key}`);
        return [key, entries[0]];
      }),
    ) as Record<(typeof required)[number], string>;
    if (values.v !== "1" || !/^\d+$/.test(values.c)) throw new Error("invalid version");
    if (!isAddress(values.m) || !isAddress(values.t)) throw new Error("invalid address");
    if (!/^\d+$/.test(values.a) || !/^\d+$/.test(values.x)) throw new Error("invalid number");
    if (!isHex(values.k) || size(values.k) !== 32) throw new Error("invalid nonce");
    if (!isHex(values.s) || size(values.s) < 65) throw new Error("invalid signature");
    return {
      chainId: Number.parseInt(values.c, 10),
      request: {
        merchant: getAddress(values.m),
        merchantName: normalize(values.n),
        token: getAddress(values.t),
        amount: BigInt(values.a),
        expiry: BigInt(values.x),
        nonce: values.k,
      },
      signature: values.s,
    };
  } catch (cause) {
    throw new TapDecodeError("Malformed payment request", { cause });
  }
}

function flipLastHex(value: string): string {
  const last = value.at(-1)?.toLowerCase();
  return `${value.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

export function tamperRequestUrl(url: string, field: TamperField): string {
  const parsed = new URL(url);
  const current = parsed.searchParams.get(field);
  if (current === null) throw new TapDecodeError(`Missing field: ${field}`);
  if (field === "m" || field === "t" || field === "k") {
    parsed.searchParams.set(field, flipLastHex(current));
  } else if (field === "n") {
    parsed.searchParams.set(field, `${current}-tampered`);
  } else {
    parsed.searchParams.set(field, (BigInt(current) + 1n).toString());
  }
  return parsed.toString();
}

function displayUsdc(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `$${whole}.${fraction}`;
}

export function createFakeCore(overrides: Partial<TapCoreLike> = {}): TapCoreLike {
  const core: TapCoreLike = {
    newChargeRequest: createRequest,
    signRequest: sign,
    encodeRequestUrl: encode,
    decodeRequestUrl: decode,
    async verifyRequest(signed) {
      return {
        ok: true,
        ensName: signed.request.merchantName,
        displayName: "Takoyaki Stand",
        tokenSymbol: "USDC",
        displayAmount: displayUsdc(signed.request.amount),
        expiresAt: new Date(Number(signed.request.expiry) * 1000),
      };
    },
    async payWithPermit() {
      return toHex(new Uint8Array(32).fill(2));
    },
    async waitForPayment() {
      return "success";
    },
    watchPaid(_merchant, _nonce, onPaid) {
      const timer = setTimeout(() => onPaid(null), 2_000);
      return () => clearTimeout(timer);
    },
  };
  return { ...core, ...overrides };
}
