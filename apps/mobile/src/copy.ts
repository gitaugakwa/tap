export type CopyErrorCode =
  | "malformed"
  | "unknown_chain"
  | "unknown_token"
  | "expired"
  | "bad_signature"
  | "not_under_parent"
  | "ens_unresolved"
  | "ens_mismatch"
  | "network_error"
  | "insufficient_funds"
  | "insufficient_gas"
  | "already_paid"
  | "nfc_disabled"
  | "nfc_unsupported"
  | "read_timeout"
  | "fallback";

const errorMessages: Record<CopyErrorCode, string> = {
  malformed: "This isn't a valid Tap payment request.",
  unknown_chain: "This request uses a network or token Tap doesn't support.",
  unknown_token: "This request uses a network or token Tap doesn't support.",
  expired: "This payment request has expired. Ask the merchant to try again.",
  bad_signature: "The request wasn't signed by this merchant. It may have been tampered with.",
  not_under_parent: "This merchant isn't registered on tap.eth.",
  ens_unresolved: "This merchant name isn't registered.",
  ens_mismatch: "This merchant name belongs to someone else.",
  network_error: "Couldn't check the merchant. Check your connection and try again.",
  insufficient_funds: "Not enough USDC to pay.",
  insufficient_gas: "Not enough Base Sepolia ETH for gas.",
  already_paid: "This request has already been paid.",
  nfc_disabled: "Turn on NFC in your phone's settings.",
  nfc_unsupported: "This phone doesn't support NFC. Use QR instead.",
  read_timeout: "No tap detected. Try again.",
  fallback: "Something went wrong. Try again.",
};

function getErrorMessage(code?: string | null): string {
  return code && Object.hasOwn(errorMessages, code)
    ? errorMessages[code as CopyErrorCode]
    : errorMessages.fallback;
}

function ensVerifiedLabel(ensName: string): string {
  return `${ensName} ✓`;
}

export const copy = { errorMessages, getErrorMessage, ensVerifiedLabel } as const;
