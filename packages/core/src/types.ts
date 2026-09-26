import type { Address, Hash, Hex, LocalAccount, PublicClient } from "viem";

export type PaymentRequest = {
  merchant: Address;
  token: Address;
  amount: bigint;
  nonce: Hex;
  expiry: bigint;
  merchantName: string;
};

export type SignedRequest = {
  chainId: number;
  request: PaymentRequest;
  signature: Hex;
};

export type VerifyFailure =
  | "malformed"
  | "unknown_chain"
  | "unknown_token"
  | "expired"
  | "bad_signature"
  | "not_under_parent"
  | "ens_unresolved"
  | "ens_mismatch"
  | "network_error";

export type VerifyResult =
  | {
      ok: true;
      ensName: string;
      displayName: string | null;
      tokenSymbol: string;
      displayAmount: string;
      expiresAt: Date;
    }
  | { ok: false; reason: VerifyFailure };

export type PermitSig = { deadline: bigint; v: number; r: Hex; s: Hex };

export type MerchantProfile = { address: Address | null; displayName: string | null };

export type MerchantSetupCheck =
  | { ok: true; displayName: string | null }
  | {
      ok: false;
      reason: "not_under_parent" | "ens_unresolved" | "ens_mismatch" | "network_error";
    };

export type WalletBalances = {
  gas: { symbol: "ETH"; amount: bigint; display: string };
  tokens: { address: Address; symbol: string; amount: bigint; display: string }[];
};

export type TapConfig = {
  rpcUrls?: { payment?: string; ens?: string };
  paymentClient?: PublicClient;
  ensClient?: PublicClient;
  now?: () => Date;
};

export type { Address, Hash, Hex, LocalAccount };
