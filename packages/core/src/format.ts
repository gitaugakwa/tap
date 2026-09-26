import type { Address } from "viem";
import { DEFAULT_TOKEN, getTokenConfig, PAYMENT_CHAIN_ID } from "./config/chains";
import { MAX_CHARGE } from "./config/constants";
import { TapInputError } from "./errors";

const AMOUNT_INPUT = /^\d+(\.\d*)?$/;

function tokenConfigOrThrow(token: Address = DEFAULT_TOKEN) {
  const config = getTokenConfig(PAYMENT_CHAIN_ID, token);
  if (!config) throw new TapInputError("unknown_token", "Token is not on the allowlist");
  return config;
}

export function formatAmount(amount: bigint, token?: Address): string {
  const { decimals, display, symbol } = tokenConfigOrThrow(token);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, "0");

  if (display === "usd") return `$${whole}.${fraction.slice(0, 2)}`;
  return `${whole}.${fraction} ${symbol}`;
}

export function formatTokenUnits(amount: bigint, decimals: number, maxFraction = 6): string {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    !Number.isInteger(maxFraction) ||
    maxFraction < 0
  ) {
    throw new TapInputError("invalid_amount", "Token precision must be a non-negative integer");
  }
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale)
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFraction)
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function parseAmountInput(input: string, token?: Address): bigint {
  const { decimals } = tokenConfigOrThrow(token);
  const trimmed = input.trim();

  if (!AMOUNT_INPUT.test(trimmed)) {
    throw new TapInputError("invalid_amount", "Enter an amount like 5 or 5.00");
  }

  const [whole = "", fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new TapInputError("invalid_amount", `At most ${decimals} decimal places`);
  }

  const amount = BigInt(`${whole}${fraction.padEnd(decimals, "0")}`);
  if (amount > MAX_CHARGE) {
    throw new TapInputError("invalid_amount", "Amount is above the demo limit");
  }

  return amount;
}
