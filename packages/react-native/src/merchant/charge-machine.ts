export type ChargeState =
  | "idle"
  | "preparing"
  | "waiting"
  | "paid"
  | "expired"
  | "cancelled"
  | "error";

export type ChargeMachineState = { state: ChargeState };
export type ChargeMachineAction = { type: string };

export function chargeReducer(
  _state: ChargeMachineState,
  _action: ChargeMachineAction,
): ChargeMachineState {
  throw new Error("not implemented: chargeReducer");
}
