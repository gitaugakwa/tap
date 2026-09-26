import type { SignedRequest } from "../types";

export function encodeRequestUrl(_signed: SignedRequest): string {
  throw new Error("not implemented: encodeRequestUrl");
}

export function decodeRequestUrl(_url: string): SignedRequest {
  throw new Error("not implemented: decodeRequestUrl");
}
