import {
  type Address,
  BaseError,
  ContractFunctionRevertedError,
  getAddress,
  type Hash,
  InsufficientFundsError,
  isAddressEqual,
  type LocalAccount,
  size,
  stringToHex,
  zeroAddress,
} from "viem";
import { normalize } from "viem/ens";
import { tapMerchantRegistrarAbi } from "../config/abi";
import { ENS_PARENT, ensConfig } from "../config/chains";
import { getEnsClient, getEnsWalletClient } from "../config/clients";
import { ENS_DISPLAY_NAME_KEY } from "../config/constants";
import { TapError, TapInputError } from "../errors";
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

function isValidLabel(label: string): boolean {
  return (
    label.length >= 3 &&
    label.length <= 32 &&
    !label.startsWith("-") &&
    !label.endsWith("-") &&
    LABEL_PATTERN.test(label)
  );
}

function validateRegistration(
  options: { label: string; displayName: string; owner: Address },
  account: LocalAccount,
): void {
  if (!isValidLabel(options.label)) {
    throw new TapInputError(
      "invalid_label",
      "Merchant label must be 3-32 lowercase letters, numbers, or hyphens",
    );
  }
  const displayNameLength = size(stringToHex(options.displayName));
  if (displayNameLength < 1 || displayNameLength > 64) {
    throw new TapInputError("invalid_display_name", "Display name must be 1-64 bytes");
  }
  if (!isAddressEqual(options.owner, account.address)) {
    throw new TapInputError("owner_mismatch", "Merchant owner must match the signing account");
  }
}

function mapRegistrationError(error: unknown): TapError {
  if (error instanceof TapError) return error;

  if (error instanceof BaseError) {
    const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      if (reverted.data?.errorName === "NameNotAvailable") {
        return new TapError("name_taken", "Merchant name is already registered", { cause: error });
      }
      return new TapError("registration_reverted", "Merchant registration was rejected", {
        cause: error,
      });
    }

    if (error.walk((cause) => cause instanceof InsufficientFundsError)) {
      return new TapError("registration_insufficient_gas", "Not enough Sepolia ETH for gas", {
        cause: error,
      });
    }
    return new TapError("registration_network", "ENS network request failed", { cause: error });
  }

  return new TapError("registration_failed", "Merchant registration failed", {
    cause: error instanceof Error ? error : undefined,
  });
}

export async function registerMerchant(
  options: { label: string; displayName: string; owner: Address },
  account: LocalAccount,
): Promise<Hash> {
  validateRegistration(options, account);

  try {
    const client = getEnsClient();
    const available = await client.readContract({
      address: ensConfig.merchantRegistrar,
      abi: tapMerchantRegistrarAbi,
      functionName: "isAvailable",
      args: [options.label],
    });
    if (!available) throw new TapError("name_taken", "Merchant name is already registered");

    const { request } = await client.simulateContract({
      address: ensConfig.merchantRegistrar,
      abi: tapMerchantRegistrarAbi,
      functionName: "register",
      args: [options.label, options.owner, options.displayName],
      account,
    });
    const hash = await getEnsWalletClient(account).writeContract(request);
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") {
      throw new TapError("registration_reverted", "Merchant registration reverted");
    }
    return hash;
  } catch (error) {
    throw mapRegistrationError(error);
  }
}

export async function isMerchantLabelAvailable(label: string): Promise<boolean> {
  if (!isValidLabel(label)) {
    throw new TapInputError(
      "invalid_label",
      "Merchant label must be 3-32 lowercase letters, numbers, or hyphens",
    );
  }

  try {
    return await getEnsClient().readContract({
      address: ensConfig.merchantRegistrar,
      abi: tapMerchantRegistrarAbi,
      functionName: "isAvailable",
      args: [label],
    });
  } catch (error) {
    throw mapRegistrationError(error);
  }
}
