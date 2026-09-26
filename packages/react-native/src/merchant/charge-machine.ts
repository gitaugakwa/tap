export type ChargeState =
  | "idle"
  | "preparing"
  | "waiting"
  | "paid"
  | "expired"
  | "cancelled"
  | "error";

export type ChargeMachineState = { state: ChargeState };
export type ChargeMachineAction =
  | { type: "START" }
  | { type: "READY" }
  | { type: "PAID" }
  | { type: "EXPIRE" }
  | { type: "CANCEL" }
  | { type: "FAIL" }
  | { type: "RESET" };

export function chargeReducer(
  state: ChargeMachineState,
  action: ChargeMachineAction,
): ChargeMachineState {
  if (action.type === "RESET") {
    return { state: "idle" };
  }

  switch (state.state) {
    case "idle":
      return action.type === "START" ? { state: "preparing" } : state;
    case "preparing":
      if (action.type === "READY") return { state: "waiting" };
      if (action.type === "CANCEL") return { state: "cancelled" };
      if (action.type === "FAIL") return { state: "error" };
      return state;
    case "waiting":
      if (action.type === "PAID") return { state: "paid" };
      if (action.type === "EXPIRE") return { state: "expired" };
      if (action.type === "CANCEL") return { state: "cancelled" };
      if (action.type === "FAIL") return { state: "error" };
      return state;
    case "paid":
    case "expired":
    case "cancelled":
    case "error":
      return state;
  }
}
