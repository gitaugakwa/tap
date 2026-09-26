import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "@tap/core";
import { createFakeCore } from "@tap/core/testing";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { UseTapToPayResult } from "../src/customer/useTapToPay";
import type { UseChargeResult } from "../src/merchant/useCharge";

let hceEnabled = false;
let hceUrl: string | undefined;
let nfcUrl = "";

mock.module("react-native", () => ({ Platform: { OS: "android" } }));
mock.module("react-native-hce", () => ({
  HCESession: {
    getInstance: async () => ({
      setApplication: async (tag: { content: string }) => {
        hceUrl = tag.content;
      },
      setEnabled: async (enabled: boolean) => {
        hceEnabled = enabled;
      },
    }),
  },
  NFCTagType4: class {
    content: string;

    constructor({ content }: { content: string }) {
      this.content = content;
    }
  },
  NFCTagType4NDEFContentType: { URL: "url" },
}));
mock.module("react-native-nfc-manager", () => ({
  default: {
    cancelTechnologyRequest: async () => {},
    getTag: async () => ({ ndefMessage: [{ payload: [] }] }),
    isEnabled: async () => true,
    isSupported: async () => true,
    requestTechnology: async () => {},
    start: async () => {},
  },
  Ndef: {
    isType: () => true,
    RTD_URI: "U",
    TNF_WELL_KNOWN: 1,
    uri: { decodePayload: () => nfcUrl },
  },
  NfcAdapter: { FLAG_READER_NFC_A: 1 },
  NfcTech: { Ndef: "Ndef" },
}));

const { useCharge } = await import("../src/merchant/useCharge");
const { useTapToPay } = await import("../src/customer/useTapToPay");

function renderHook<T>(hook: () => T) {
  let current: T;
  let renderer: ReactTestRenderer;
  function Harness() {
    current = hook();
    return null;
  }
  act(() => {
    renderer = create(createElement(Harness));
  });
  return {
    get current() {
      return current;
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
});

describe("fake core hook integration", () => {
  test("useCharge broadcasts an NFC request and observes payment", async () => {
    hceEnabled = false;
    hceUrl = undefined;
    const account = privateKeyToAccount(generatePrivateKey());
    let markPaid: (() => void) | undefined;
    const core = createFakeCore({
      watchPaid(_merchant, _nonce, onPaid) {
        markPaid = () => onPaid(null);
        return () => {};
      },
    });
    const result = renderHook<UseChargeResult>(() =>
      useCharge({ account, merchantName: "yoyogi-market.tap.eth", core }),
    );

    await act(async () => result.current.start(5_000_000n));
    expect(result.current.state).toBe("waiting");
    expect(hceUrl).toStartWith("https://tap-pay.xyz/p?");
    expect(hceEnabled).toBe(true);

    await act(async () => markPaid?.());
    expect(result.current.state).toBe("paid");
    expect(hceEnabled).toBe(false);
    result.unmount();
  });

  test("useTapToPay reads, verifies, and pays an NFC request", async () => {
    const merchant = privateKeyToAccount(generatePrivateKey());
    const customer = privateKeyToAccount(generatePrivateKey());
    const core = createFakeCore();
    const request = core.newChargeRequest({
      merchant: merchant.address,
      merchantName: "yoyogi-market.tap.eth",
      amount: 5_000_000n,
    });
    const signed = await core.signRequest(request, merchant);
    nfcUrl = core.encodeRequestUrl(signed);
    const result = renderHook<UseTapToPayResult>(() => useTapToPay({ account: customer, core }));

    await act(async () => result.current.startReading());
    expect(result.current.state).toBe("verified");
    expect(result.current.verify?.ok).toBe(true);

    await act(async () => result.current.confirm());
    expect(result.current.state).toBe("paid");
    expect(result.current.txHash).toBeDefined();
    result.unmount();
  });
});
