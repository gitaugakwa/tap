import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Hash, Hex, PublicClient } from "viem";
import { configureTap } from "../../src/config/clients";
import { watchPaid } from "../../src/payment/watch";

const merchant = "0x1111111111111111111111111111111111111111" as const;
const nonce = `0x${"11".repeat(32)}` as Hex;
const hash = `0x${"22".repeat(32)}` as Hash;

afterEach(() => configureTap());

describe("watchPaid", () => {
  test("fires once when duplicate event logs arrive and unsubscribes", () => {
    const unwatch = mock(() => undefined);
    let onLogs: ((logs: { transactionHash: Hash }[]) => void) | undefined;
    const watchContractEvent = mock(
      (options: { onLogs(logs: { transactionHash: Hash }[]): void }) => {
        onLogs = options.onLogs;
        return unwatch;
      },
    );
    configureTap({
      paymentClient: { watchContractEvent } as unknown as PublicClient,
    });
    const onPaid = mock(() => undefined);

    const unsubscribe = watchPaid(merchant, nonce, onPaid);
    onLogs?.([{ transactionHash: hash }]);
    onLogs?.([{ transactionHash: hash }]);
    unsubscribe();

    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(hash);
    expect(unwatch).toHaveBeenCalledTimes(1);
    expect(watchContractEvent.mock.calls[0]?.[0]).toMatchObject({
      eventName: "Paid",
      args: { merchant, nonce },
    });
  });

  test("polls as a fallback and reports null when polling wins", async () => {
    const unwatch = mock(() => undefined);
    const readContract = mock(async () => true);
    let onLogs: ((logs: { transactionHash: Hash }[]) => void) | undefined;
    const watchContractEvent = mock(
      (options: { onLogs(logs: { transactionHash: Hash }[]): void }) => {
        onLogs = options.onLogs;
        return unwatch;
      },
    );
    configureTap({
      paymentClient: { readContract, watchContractEvent } as unknown as PublicClient,
    });
    const onPaid = mock(() => undefined);

    watchPaid(merchant, nonce, onPaid);
    await Bun.sleep(2_050);
    onLogs?.([{ transactionHash: hash }]);

    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(null);
    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  test("unsubscribe stops both event watching and polling", async () => {
    const unwatch = mock(() => undefined);
    const readContract = mock(async () => true);
    configureTap({
      paymentClient: {
        readContract,
        watchContractEvent: () => unwatch,
      } as unknown as PublicClient,
    });
    const onPaid = mock(() => undefined);

    const unsubscribe = watchPaid(merchant, nonce, onPaid);
    unsubscribe();
    await Bun.sleep(2_050);

    expect(onPaid).not.toHaveBeenCalled();
    expect(readContract).not.toHaveBeenCalled();
    expect(unwatch).toHaveBeenCalledTimes(1);
  });
});
