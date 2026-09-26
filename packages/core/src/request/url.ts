import { getAddress, type Hex } from "viem";
import { normalize } from "viem/ens";
import { REQUEST_URL_BASE, REQUEST_URL_VERSION } from "../config/constants";
import { TapDecodeError, TapInputError } from "../errors";
import type { SignedRequest } from "../types";

const REQUIRED_PARAMS = ["v", "c", "m", "n", "t", "a", "x", "k", "s"] as const;
const REQUEST_URL_BYTE_LIMIT = 400;
const MAX_UINT256 = (1n << 256n) - 1n;
const MAX_UINT64 = (1n << 64n) - 1n;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const NONCE_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const SIGNATURE_PATTERN = /^0x(?:[0-9a-fA-F]{2}){65,}$/;
const DECIMAL_PATTERN = /^\d+$/;

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function encodeRequestUrl(signed: SignedRequest): string {
  const { request } = signed;
  const url = `${REQUEST_URL_BASE}?v=${REQUEST_URL_VERSION}&c=${signed.chainId}&m=${request.merchant}&n=${encodeURIComponent(request.merchantName)}&t=${request.token}&a=${request.amount}&x=${request.expiry}&k=${request.nonce}&s=${signed.signature}`;
  if (utf8ByteLength(url) >= REQUEST_URL_BYTE_LIMIT) {
    throw new TapInputError("request_too_large", "Encoded payment request must be under 400 bytes");
  }
  return url;
}

export function decodeRequestUrl(url: string): SignedRequest {
  if (utf8ByteLength(url) >= REQUEST_URL_BYTE_LIMIT) {
    throw new TapDecodeError("Payment request URL must be under 400 bytes");
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname !== "/p") throw new Error("Invalid request path");

    const values = Object.fromEntries(
      REQUIRED_PARAMS.map((param) => {
        const matches = parsed.searchParams.getAll(param);
        if (matches.length !== 1 || matches[0] === "") {
          throw new Error(`Invalid request parameter: ${param}`);
        }
        return [param, matches[0]];
      }),
    ) as Record<(typeof REQUIRED_PARAMS)[number], string>;

    if (values.v !== String(REQUEST_URL_VERSION)) throw new Error("Invalid request version");
    if (!DECIMAL_PATTERN.test(values.c)) throw new Error("Invalid chain ID");
    const chainId = Number(values.c);
    if (!Number.isSafeInteger(chainId)) throw new Error("Invalid chain ID");
    if (!ADDRESS_PATTERN.test(values.m) || !ADDRESS_PATTERN.test(values.t)) {
      throw new Error("Invalid address");
    }
    const amount = DECIMAL_PATTERN.test(values.a) ? BigInt(values.a) : 0n;
    if (amount <= 0n || amount > MAX_UINT256) {
      throw new Error("Invalid amount");
    }
    if (!DECIMAL_PATTERN.test(values.x)) throw new Error("Invalid expiry");
    const expiry = BigInt(values.x);
    if (expiry > MAX_UINT64) throw new Error("Invalid expiry");
    if (!NONCE_PATTERN.test(values.k)) throw new Error("Invalid nonce");
    if (!SIGNATURE_PATTERN.test(values.s)) throw new Error("Invalid signature");

    return {
      chainId,
      request: {
        merchant: getAddress(values.m),
        merchantName: normalize(values.n),
        token: getAddress(values.t),
        amount,
        expiry,
        nonce: values.k as Hex,
      },
      signature: values.s as Hex,
    };
  } catch (cause) {
    throw new TapDecodeError("Malformed payment request", { cause });
  }
}
