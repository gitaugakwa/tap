import {
  encodeRequestUrl,
  type Hash,
  type LocalAccount,
  newChargeRequest,
  signRequest,
  watchPaid,
} from "@tap/core";
import { type TamperField, type TapCoreLike, tamperRequestUrl } from "@tap/core/testing";
import { useEffect, useReducer, useRef, useState } from "react";
import { type ChargeState, chargeReducer } from "./charge-machine";
import { startCharge, stopCharge } from "./hce";

export type UseChargeOptions = {
  account: LocalAccount;
  merchantName: string;
  transport?: "nfc" | "qr";
  demoTamper?: TamperField | null;
  core?: TapCoreLike;
};

export type UseChargeResult = {
  state: ChargeState;
  amount?: bigint;
  url?: string;
  expiresAt?: Date;
  txHash?: Hash | null;
  error?: { code: string; message: string };
  start(amount: bigint): Promise<void>;
  cancel(): Promise<void>;
  reset(): void;
};

const noCleanup = async () => {};

function describeError(error: unknown) {
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "unknown";
    return { code, message: error.message };
  }
  return { code: "unknown", message: String(error) };
}

export function useCharge({
  account,
  merchantName,
  transport = "nfc",
  demoTamper,
  core: injectedCore,
}: UseChargeOptions): UseChargeResult {
  const core: Pick<
    TapCoreLike,
    "newChargeRequest" | "signRequest" | "encodeRequestUrl" | "watchPaid"
  > = injectedCore ?? { newChargeRequest, signRequest, encodeRequestUrl, watchPaid };
  const [machine, dispatch] = useReducer(chargeReducer, { state: "idle" });
  const [amount, setAmount] = useState<bigint>();
  const [url, setUrl] = useState<string>();
  const [expiresAt, setExpiresAt] = useState<Date>();
  const [txHash, setTxHash] = useState<Hash | null>();
  const [error, setError] = useState<{ code: string; message: string }>();
  const operationRef = useRef(0);
  const activeRef = useRef(false);
  const cleanupRef = useRef<() => Promise<void>>(noCleanup);

  async function cleanup() {
    const current = cleanupRef.current;
    cleanupRef.current = noCleanup;
    await current();
  }

  useEffect(
    () => () => {
      operationRef.current += 1;
      activeRef.current = false;
      const current = cleanupRef.current;
      cleanupRef.current = noCleanup;
      void current();
    },
    [],
  );

  async function start(nextAmount: bigint) {
    if (activeRef.current || machine.state !== "idle") return;

    activeRef.current = true;
    const operation = ++operationRef.current;
    dispatch({ type: "START" });
    setAmount(nextAmount);
    setUrl(undefined);
    setExpiresAt(undefined);
    setTxHash(undefined);
    setError(undefined);

    let stopWatching = () => {};
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const usesHce = transport === "nfc";
    cleanupRef.current = async () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      stopWatching();
      if (usesHce) await stopCharge();
    };

    try {
      const request = core.newChargeRequest({
        merchant: account.address,
        merchantName,
        amount: nextAmount,
      });
      const signed = await core.signRequest(request, account);
      if (operation !== operationRef.current) return;

      const encoded = core.encodeRequestUrl(signed);
      const nextUrl = demoTamper ? tamperRequestUrl(encoded, demoTamper) : encoded;
      const expiry = new Date(Number(request.expiry) * 1_000);
      if (usesHce) await startCharge(nextUrl);
      if (operation !== operationRef.current) return;

      stopWatching = core.watchPaid(request.merchant, request.nonce, (hash) => {
        if (operation !== operationRef.current) return;
        operationRef.current += 1;
        activeRef.current = false;
        setTxHash(hash);
        dispatch({ type: "PAID" });
        void cleanup();
      });
      expiryTimer = setTimeout(
        () => {
          if (operation !== operationRef.current) return;
          operationRef.current += 1;
          activeRef.current = false;
          dispatch({ type: "EXPIRE" });
          void cleanup();
        },
        Math.max(0, expiry.getTime() - Date.now()),
      );
      setUrl(nextUrl);
      setExpiresAt(expiry);
      dispatch({ type: "READY" });
    } catch (cause) {
      if (operation !== operationRef.current) return;
      activeRef.current = false;
      setError(describeError(cause));
      dispatch({ type: "FAIL" });
      await cleanup();
    }
  }

  async function cancel() {
    operationRef.current += 1;
    activeRef.current = false;
    await cleanup();
    dispatch({ type: "CANCEL" });
  }

  function reset() {
    operationRef.current += 1;
    activeRef.current = false;
    void cleanup();
    setAmount(undefined);
    setUrl(undefined);
    setExpiresAt(undefined);
    setTxHash(undefined);
    setError(undefined);
    dispatch({ type: "RESET" });
  }

  return { state: machine.state, amount, url, expiresAt, txHash, error, start, cancel, reset };
}
