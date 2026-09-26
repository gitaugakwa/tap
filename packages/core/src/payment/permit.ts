import type { LocalAccount } from "viem";
import type { PermitSig, SignedRequest } from "../types";

export function signPermit(_signed: SignedRequest, _account: LocalAccount): Promise<PermitSig> {
  throw new Error("not implemented: signPermit");
}
