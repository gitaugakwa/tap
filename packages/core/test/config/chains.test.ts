import { describe, expect, test } from "bun:test";
import type { Address } from "viem";
import {
  DEFAULT_TOKEN,
  ENS_CHAIN_ID,
  ENS_PARENT,
  getPaymentChain,
  getTokenConfig,
  PAYMENT_CHAIN_ID,
} from "../../src/config/chains";
import {
  ENS_DISPLAY_NAME_KEY,
  MAX_CHARGE,
  REQUEST_TTL_SECONDS,
  REQUEST_URL_BASE,
  REQUEST_URL_VERSION,
} from "../../src/config/constants";

describe("chain config", () => {
  test("contains only the documented payment chain and USDC token", () => {
    expect(PAYMENT_CHAIN_ID).toBe(84532);
    expect(ENS_CHAIN_ID).toBe(11155111);
    expect(ENS_PARENT).toBe("tap.eth");
    expect(DEFAULT_TOKEN).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    expect(getPaymentChain(PAYMENT_CHAIN_ID)?.chain.id).toBe(PAYMENT_CHAIN_ID);
    expect(getPaymentChain(1)).toBeUndefined();
    expect(getTokenConfig(PAYMENT_CHAIN_ID, DEFAULT_TOKEN)).toEqual({
      address: DEFAULT_TOKEN,
      symbol: "USDC",
      decimals: 6,
      display: "usd",
    });
  });

  test("looks up allowlisted tokens case-insensitively", () => {
    const lowercaseToken = DEFAULT_TOKEN.toLowerCase() as Address;
    expect(getTokenConfig(PAYMENT_CHAIN_ID, lowercaseToken)?.address).toBe(DEFAULT_TOKEN);
    expect(
      getTokenConfig(PAYMENT_CHAIN_ID, "0x0000000000000000000000000000000000000001"),
    ).toBeUndefined();
  });
});

test("request constants match the protocol", () => {
  expect(REQUEST_TTL_SECONDS).toBe(120);
  expect(REQUEST_URL_BASE).toBe("https://tap-pay.xyz/p");
  expect(REQUEST_URL_VERSION).toBe(1);
  expect(ENS_DISPLAY_NAME_KEY).toBe("name");
  expect(MAX_CHARGE).toBe(1_000_000_000n);
});
