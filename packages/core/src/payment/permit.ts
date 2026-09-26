import { type LocalAccount, parseAbi, parseSignature } from "viem";
import { getPaymentChain, getTokenConfig } from "../config/chains";
import { getPaymentClient } from "../config/clients";
import { TapPayError } from "../errors";
import type { PermitSig, SignedRequest } from "../types";

const permitTokenAbi = parseAbi([
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function nonces(address owner) view returns (uint256)",
]);

const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export async function signPermit(signed: SignedRequest, account: LocalAccount): Promise<PermitSig> {
  const chain = getPaymentChain(signed.chainId);
  if (!chain) throw new TapPayError("unknown_chain", "Payment chain is not supported");
  if (!getTokenConfig(signed.chainId, signed.request.token)) {
    throw new TapPayError("unknown_token", "Payment token is not supported");
  }

  const client = getPaymentClient();
  const contract = { address: signed.request.token, abi: permitTokenAbi } as const;
  const [name, version, nonce] = await Promise.all([
    client.readContract({ ...contract, functionName: "name" }),
    client.readContract({ ...contract, functionName: "version" }),
    client.readContract({ ...contract, functionName: "nonces", args: [account.address] }),
  ]);
  const deadline = signed.request.expiry;
  const signature = await account.signTypedData({
    domain: {
      name,
      version,
      chainId: signed.chainId,
      verifyingContract: signed.request.token,
    },
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message: {
      owner: account.address,
      spender: chain.tapPay,
      value: signed.request.amount,
      nonce,
      deadline,
    },
  });
  const parsed = parseSignature(signature);

  return { deadline, v: parsed.yParity === 0 ? 27 : 28, r: parsed.r, s: parsed.s };
}
