import type { Address, Hash, Hex } from "viem";

export function watchPaid(
  _merchant: Address,
  _nonce: Hex,
  _onPaid: (transaction: Hash | null) => void,
): () => void {
  throw new Error("not implemented: watchPaid");
}
