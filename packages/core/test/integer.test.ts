import { describe, expect, test } from "bun:test";
import { safeInteger } from "../src/integer";

describe("safeInteger", () => {
  test("converts bounded bigint values and rejects precision loss", () => {
    expect(safeInteger(0n)).toBe(0);
    expect(safeInteger(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => safeInteger(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow();
    expect(() => safeInteger(BigInt(Number.MIN_SAFE_INTEGER) - 1n)).toThrow();
  });
});
