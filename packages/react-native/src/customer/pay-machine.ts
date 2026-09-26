export type PayState =
  | "idle"
  | "reading"
  | "verifying"
  | "verified"
  | "rejected"
  | "paying"
  | "paid"
  | "failed"
  | "error";

export type PayMachineState = { state: PayState };
export type PayMachineAction =
  | { type: "START_READING" }
  | { type: "SUBMIT" }
  | { type: "VERIFIED" }
  | { type: "REJECTED" }
  | { type: "CONFIRM" }
  | { type: "PAID" }
  | { type: "FAIL" }
  | { type: "RESET" };

export function payReducer(state: PayMachineState, action: PayMachineAction): PayMachineState {
  if (action.type === "RESET") {
    return { state: "idle" };
  }

  switch (state.state) {
    case "idle":
      if (action.type === "START_READING") return { state: "reading" };
      if (action.type === "SUBMIT") return { state: "verifying" };
      return state;
    case "reading":
      if (action.type === "SUBMIT") return { state: "verifying" };
      if (action.type === "FAIL") return { state: "error" };
      return state;
    case "verifying":
      if (action.type === "VERIFIED") return { state: "verified" };
      if (action.type === "REJECTED") return { state: "rejected" };
      if (action.type === "FAIL") return { state: "error" };
      return state;
    case "verified":
      if (action.type === "CONFIRM") return { state: "paying" };
      if (action.type === "REJECTED") return { state: "rejected" };
      return state;
    case "paying":
      if (action.type === "PAID") return { state: "paid" };
      if (action.type === "FAIL") return { state: "failed" };
      return state;
    case "rejected":
    case "paid":
    case "failed":
    case "error":
      return state;
  }
}
