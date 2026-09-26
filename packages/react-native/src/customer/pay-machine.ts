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
export type PayMachineAction = { type: string };

export function payReducer(_state: PayMachineState, _action: PayMachineAction): PayMachineState {
  throw new Error("not implemented: payReducer");
}
