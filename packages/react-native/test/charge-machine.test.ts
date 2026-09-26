import { describe, expect, test } from "bun:test";
import {
  type ChargeMachineAction,
  type ChargeState,
  chargeReducer,
} from "../src/merchant/charge-machine";

function reduce(state: ChargeState, type: ChargeMachineAction["type"]): ChargeState {
  return chargeReducer({ state }, { type }).state;
}

describe("chargeReducer", () => {
  test.each([
    ["idle", "START", "preparing"],
    ["preparing", "READY", "waiting"],
    ["preparing", "CANCEL", "cancelled"],
    ["preparing", "FAIL", "error"],
    ["waiting", "PAID", "paid"],
    ["waiting", "EXPIRE", "expired"],
    ["waiting", "CANCEL", "cancelled"],
    ["waiting", "FAIL", "error"],
  ] as const)("transitions %s + %s to %s", (state, action, expected) => {
    expect(reduce(state, action)).toBe(expected);
  });

  test.each([
    ["idle", "PAID"],
    ["preparing", "PAID"],
    ["waiting", "START"],
    ["paid", "START"],
    ["expired", "START"],
    ["cancelled", "START"],
    ["error", "START"],
  ] as const)("ignores invalid transition %s + %s", (state, action) => {
    expect(reduce(state, action)).toBe(state);
  });

  test.each(["idle", "preparing", "waiting", "paid", "expired", "cancelled", "error"] as const)(
    "resets %s to idle",
    (state) => {
      expect(reduce(state, "RESET")).toBe("idle");
    },
  );
});
