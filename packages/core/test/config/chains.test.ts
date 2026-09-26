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
    expect(getPaymentChain(PAYMENT_CHAIN_ID)?.swap).toEqual({
      adapter: "0xA36df4D6DA08bA1FbE89ddEB7229218FAf0BF84d",
      router: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
      quoter: "0xC5290058841028F1614F3A6F0F5816cAd0df5E27",
      permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      weth: "0x4200000000000000000000000000000000000006",
      feeTiers: [100, 500, 3_000, 10_000],
    });
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
