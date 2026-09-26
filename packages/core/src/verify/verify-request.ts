import type { SignedRequest, VerifyResult } from "../types";

export function verifyRequest(_signed: SignedRequest): Promise<VerifyResult> {
  throw new Error("not implemented: verifyRequest");
}
