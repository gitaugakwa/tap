import { TapInputError } from "./errors";

export function safeInteger(value: bigint): number {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new TapInputError("invalid_integer", "Integer exceeds JavaScript's safe range");
  }
  return Number(value);
}
