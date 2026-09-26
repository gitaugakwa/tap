import { describe, expect, test } from "bun:test";
import type { Address } from "../src";
import { DEFAULT_TOKEN, formatAmount, parseAmountInput, TapInputError } from "../src";
import { MAX_CHARGE } from "../src/config/constants";

const UNKNOWN_TOKEN = "0x1111111111111111111111111111111111111111" as Address;

describe("parseAmountInput", () => {
  test("accepts the same value written with different precision", () => {
    expect(parseAmountInput("5")).toBe(5_000_000n);
    expect(parseAmountInput("5.0")).toBe(5_000_000n);
    expect(parseAmountInput("5.00")).toBe(5_000_000n);
  });

  test("parses fractional and zero amounts", () => {
    expect(parseAmountInput("0.01")).toBe(10_000n);
    expect(parseAmountInput("0.1")).toBe(100_000n);
    expect(parseAmountInput("12.34")).toBe(12_340_000n);
    expect(parseAmountInput("0")).toBe(0n);
  });

  test("tolerates surrounding whitespace and a trailing point", () => {
    expect(parseAmountInput("  5.00  ")).toBe(5_000_000n);
    expect(parseAmountInput("5.")).toBe(5_000_000n);
  });

  test("accepts the demo cap and rejects one unit above it", () => {
    expect(parseAmountInput("1000")).toBe(MAX_CHARGE);
    expect(() => parseAmountInput("1000.01")).toThrow(TapInputError);
  });

  test("rejects negatives, junk and more decimals than the token has", () => {
    for (const input of ["-5", "5,00", "abc", "", " ", "5.5.5", "1e6", "+5", "$5"]) {
      expect(() => parseAmountInput(input)).toThrow(TapInputError);
    }
    expect(() => parseAmountInput("5.1234567")).toThrow(TapInputError);
  });

  test("rejects a token that is not on the allowlist", () => {
    expect(() => parseAmountInput("5", UNKNOWN_TOKEN)).toThrow(TapInputError);
  });

  test("failures carry a usable code and never leak a raw message", () => {
    try {
      parseAmountInput("abc");
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TapInputError);
      expect((error as TapInputError).code).toBe("invalid_amount");
    }
  });
});

describe("formatAmount", () => {
  test("renders USDC base units as a dollar string", () => {
    expect(formatAmount(5_000_000n)).toBe("$5.00");
    expect(formatAmount(0n)).toBe("$0.00");
    expect(formatAmount(10_000n)).toBe("$0.01");
    expect(formatAmount(12_340_000n)).toBe("$12.34");
    expect(formatAmount(1_000_000_000n)).toBe("$1000.00");
  });

  test("truncates sub-cent precision rather than rounding it away", () => {
    expect(formatAmount(5_009_999n)).toBe("$5.00");
    expect(formatAmount(1n)).toBe("$0.00");
  });

  test("is the inverse of parseAmountInput for two-decimal input", () => {
    // Expectations are written out rather than computed, so this test never
    // relies on the float maths the SDK is forbidden from using (INV-12).
    const roundTrips: [string, string][] = [
      ["5", "$5.00"],
      ["0.01", "$0.01"],
      ["12.34", "$12.34"],
      ["1000", "$1000.00"],
    ];
    for (const [input, expected] of roundTrips) {
      expect(formatAmount(parseAmountInput(input))).toBe(expected);
    }
  });

  test("accepts the default token explicitly and rejects an unknown one", () => {
    expect(formatAmount(5_000_000n, DEFAULT_TOKEN)).toBe("$5.00");
    expect(() => formatAmount(5_000_000n, UNKNOWN_TOKEN)).toThrow(TapInputError);
  });
});
