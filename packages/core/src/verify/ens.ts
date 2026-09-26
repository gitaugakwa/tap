import type { Address, Hash, LocalAccount } from "viem";
import type { MerchantProfile, MerchantSetupCheck } from "../types";

export function isUnderParent(_name: string): boolean {
  throw new Error("not implemented: isUnderParent");
}

export function resolveMerchant(_name: string): Promise<Address | null> {
  throw new Error("not implemented: resolveMerchant");
}

export function getMerchantProfile(_name: string): Promise<MerchantProfile> {
  throw new Error("not implemented: getMerchantProfile");
}

export function checkMerchantSetup(_name: string, _address: Address): Promise<MerchantSetupCheck> {
  throw new Error("not implemented: checkMerchantSetup");
}

export function registerMerchant(
  _options: { label: string; displayName: string; owner: Address },
  _account: LocalAccount,
): Promise<Hash> {
  throw new Error("not implemented: registerMerchant");
}

export function isMerchantLabelAvailable(_label: string): Promise<boolean> {
  throw new Error("not implemented: isMerchantLabelAvailable");
}
