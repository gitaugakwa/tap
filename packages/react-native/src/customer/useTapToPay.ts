import {
  decodeRequestUrl,
  type Hash,
  type LocalAccount,
  payWithPermit,
  type SignedRequest,
  type VerifyResult,
  verifyRequest,
  waitForPayment,
} from "@tap/core";
import type { TapCoreLike } from "@tap/core/testing";
import { useEffect, useReducer, useRef, useState } from "react";
import { type PayMachineAction, type PayState, payReducer } from "./pay-machine";
import { cancelRead, readRequest } from "./reader";

export type UseTapToPayOptions = {
  account: LocalAccount;
  core?: TapCoreLike;
};

export type UseTapToPayResult = {
  state: PayState;
  verify?: VerifyResult;
  signed?: SignedRequest;
  txHash?: Hash;
  error?: { code: string; message: string };
  startReading(): Promise<void>;
  submitUrl(url: string): Promise<void>;
  confirm(): Promise<void>;
  reset(): void;
};

function describeError(error: unknown) {
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "unknown";
    return { code, message: error.message };
  }
  return { code: "unknown", message: String(error) };
}

export function useTapToPay({
  account,
  core: injectedCore,
}: UseTapToPayOptions): UseTapToPayResult {
  const core: Pick<
    TapCoreLike,
    "decodeRequestUrl" | "verifyRequest" | "payWithPermit" | "waitForPayment"
  > = injectedCore ?? { decodeRequestUrl, verifyRequest, payWithPermit, waitForPayment };
  const [machine, dispatch] = useReducer(payReducer, { state: "idle" });
  const [verify, setVerify] = useState<VerifyResult>();
  const [signed, setSigned] = useState<SignedRequest>();
  const [txHash, setTxHash] = useState<Hash>();
  const [error, setError] = useState<{ code: string; message: string }>();
  const stateRef = useRef<PayState>("idle");
  const signedRef = useRef<SignedRequest | undefined>(undefined);
  const operationRef = useRef(0);

  function transition(action: PayMachineAction) {
    stateRef.current = payReducer({ state: stateRef.current }, action).state;
    dispatch(action);
  }

  function clearResult() {
    signedRef.current = undefined;
    setVerify(undefined);
    setSigned(undefined);
    setTxHash(undefined);
    setError(undefined);
  }

  useEffect(
    () => () => {
      operationRef.current += 1;
      void cancelRead();
    },
    [],
  );

  async function verifyUrl(url: string, operation: number) {
    transition({ type: "SUBMIT" });
    try {
      const decoded = core.decodeRequestUrl(url);
      const result = await core.verifyRequest(decoded);
      if (operation !== operationRef.current) return;

      setVerify(result);
      if (!result.ok) {
        transition({ type: "REJECTED" });
        return;
      }
      signedRef.current = decoded;
      setSigned(decoded);
      transition({ type: "VERIFIED" });
    } catch (cause) {
      if (operation !== operationRef.current) return;
      setError(describeError(cause));
      transition({ type: "FAIL" });
    }
  }

  async function startReading() {
    if (stateRef.current !== "idle") return;

    const operation = ++operationRef.current;
    clearResult();
    transition({ type: "START_READING" });
    try {
      const url = await readRequest();
      if (operation !== operationRef.current) return;
      await verifyUrl(url, operation);
    } catch (cause) {
      if (operation !== operationRef.current) return;
      setError(describeError(cause));
      transition({ type: "FAIL" });
    }
  }

  async function submitUrl(url: string) {
    if (stateRef.current !== "idle" && stateRef.current !== "reading") return;

    const operation = ++operationRef.current;
    if (stateRef.current === "reading") {
      await cancelRead();
      if (operation !== operationRef.current) return;
    }
    clearResult();
    await verifyUrl(url, operation);
  }

  async function confirm() {
    const request = signedRef.current;
    if (stateRef.current !== "verified" || !request) return;

    const operation = ++operationRef.current;
    setError(undefined);
    transition({ type: "CONFIRM" });
    try {
      const hash = await core.payWithPermit(request, account);
      if (operation !== operationRef.current) return;
      setTxHash(hash);
      const receipt = await core.waitForPayment(hash);
      if (operation !== operationRef.current) return;
      if (receipt === "success") {
        transition({ type: "PAID" });
      } else {
        setError({ code: "payment_reverted", message: "Payment transaction reverted" });
        transition({ type: "FAIL" });
      }
    } catch (cause) {
      if (operation !== operationRef.current) return;
      setError(describeError(cause));
      transition({ type: "FAIL" });
    }
  }

  function reset() {
    operationRef.current += 1;
    void cancelRead();
    clearResult();
    transition({ type: "RESET" });
  }

  return {
    state: machine.state,
    verify,
    signed,
    txHash,
    error,
    startReading,
    submitUrl,
    confirm,
    reset,
  };
}
