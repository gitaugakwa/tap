import type { Address, Hash, Hex } from "viem";
import { tapPayAbi } from "../config/abi";
import { getPaymentChain, PAYMENT_CHAIN_ID } from "../config/chains";
import { getPaymentClient } from "../config/clients";
import { TapPayError } from "../errors";
import { isPaid } from "./pay";

export function watchPaid(
  merchant: Address,
  nonce: Hex,
  onPaid: (transaction: Hash | null) => void,
): () => void {
  const chain = getPaymentChain(PAYMENT_CHAIN_ID);
  if (!chain) throw new TapPayError("unknown_chain", "Payment chain is not supported");

  let active = true;
  let polling = false;
  let unwatch: (() => void) | undefined;
  const timer = setInterval(async () => {
    if (!active || polling) return;
    polling = true;
    try {
      if (await isPaid(merchant, nonce)) finish(null);
    } catch {
      // A transient polling failure must not disable the event subscription.
    } finally {
      polling = false;
    }
  }, 2_000);

  function stop(): void {
    if (!active) return;
    active = false;
    clearInterval(timer);
    unwatch?.();
  }

  function finish(transaction: Hash | null): void {
    if (!active) return;
    stop();
    onPaid(transaction);
  }

  unwatch = getPaymentClient().watchContractEvent({
    address: chain.tapPay,
    abi: tapPayAbi,
    eventName: "Paid",
    args: { merchant, nonce },
    onLogs(logs) {
      const transaction = logs[0]?.transactionHash ?? null;
      finish(transaction);
    },
  });
  if (!active) unwatch();

  return stop;
}
