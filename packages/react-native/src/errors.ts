export type TransportErrorCode =
  | "nfc_unsupported"
  | "nfc_disabled"
  | "hce_unsupported"
  | "read_timeout"
  | "read_cancelled"
  | "charge_in_progress"
  | "transport_unknown";

export class TransportError extends Error {
  readonly code: TransportErrorCode;

  constructor(code: TransportErrorCode, message = code, options?: ErrorOptions) {
    super(message, options);
    this.name = "TransportError";
    this.code = code;
  }
}
