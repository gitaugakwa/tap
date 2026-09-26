import {
  type Address,
  getAddress,
  type Hash,
  isAddressEqual,
  type LocalAccount,
  zeroAddress,
} from "viem";
import { normalize } from "viem/ens";
import { ENS_PARENT } from "../config/chains";
import { getEnsClient } from "../config/clients";
import { ENS_DISPLAY_NAME_KEY } from "../config/constants";
import type { MerchantProfile, MerchantSetupCheck } from "../types";

const LABEL_PATTERN = /^[a-z0-9-]+$/;

export function isUnderParent(name: string): boolean {
  try {
    const normalized = normalize(name);
    const suffix = `.${ENS_PARENT}`;
    if (!normalized.endsWith(suffix)) return false;

    const label = normalized.slice(0, -suffix.length);
    return (
      label.length >= 3 &&
      label.length <= 32 &&
      !label.includes(".") &&
      !label.startsWith("-") &&
      !label.endsWith("-") &&
      LABEL_PATTERN.test(label)
    );
  } catch {
    return false;
  }
}

export async function resolveMerchant(name: string): Promise<Address | null> {
  const address = await getEnsClient().getEnsAddress({ name: normalize(name) });
  if (address === null || isAddressEqual(address, zeroAddress)) return null;
  return getAddress(address);
}

export async function getMerchantProfile(name: string): Promise<MerchantProfile> {
  const normalized = normalize(name);
  const client = getEnsClient();
  const [address, displayName] = await Promise.all([
    client.getEnsAddress({ name: normalized }),
    client.getEnsText({ name: normalized, key: ENS_DISPLAY_NAME_KEY }),
  ]);

  return {
    address: address === null || isAddressEqual(address, zeroAddress) ? null : getAddress(address),
    displayName,
  };
}

export async function checkMerchantSetup(
  name: string,
  address: Address,
): Promise<MerchantSetupCheck> {
  if (!isUnderParent(name)) return { ok: false, reason: "not_under_parent" };

  try {
    const profile = await getMerchantProfile(name);
    if (profile.address === null) return { ok: false, reason: "ens_unresolved" };
    if (!isAddressEqual(profile.address, address)) return { ok: false, reason: "ens_mismatch" };
    return { ok: true, displayName: profile.displayName };
  } catch {
    return { ok: false, reason: "network_error" };
  }
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
