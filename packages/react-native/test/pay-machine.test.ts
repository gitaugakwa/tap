import { describe, expect, test } from "bun:test";
import { type PayMachineAction, type PayState, payReducer } from "../src/customer/pay-machine";

function reduce(state: PayState, type: PayMachineAction["type"]): PayState {
  return payReducer({ state }, { type }).state;
}

describe("payReducer", () => {
  test.each([
    ["idle", "START_READING", "reading"],
    ["idle", "SUBMIT", "verifying"],
    ["reading", "SUBMIT", "verifying"],
    ["reading", "FAIL", "error"],
    ["verifying", "VERIFIED", "verified"],
    ["verifying", "REJECTED", "rejected"],
    ["verifying", "FAIL", "error"],
    ["verified", "CONFIRM", "paying"],
    ["verified", "REJECTED", "rejected"],
    ["paying", "PAID", "paid"],
    ["paying", "FAIL", "failed"],
  ] as const)("transitions %s + %s to %s", (state, action, expected) => {
    expect(reduce(state, action)).toBe(expected);
  });

  test.each([
    ["idle", "CONFIRM"],
    ["reading", "CONFIRM"],
    ["verifying", "CONFIRM"],
    ["verified", "PAID"],
    ["paying", "VERIFIED"],
    ["rejected", "START_READING"],
    ["paid", "START_READING"],
    ["failed", "START_READING"],
    ["error", "START_READING"],
  ] as const)("ignores invalid transition %s + %s", (state, action) => {
    expect(reduce(state, action)).toBe(state);
  });

  test.each([
    "idle",
    "reading",
    "verifying",
    "verified",
    "rejected",
    "paying",
    "paid",
    "failed",
    "error",
  ] as const)("resets %s to idle", (state) => {
    expect(reduce(state, "RESET")).toBe("idle");
  });
});
