import type { Address } from "@tap/core";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";

export const faucetUrls = {
  baseSepoliaEth: "https://docs.base.org/get-started/get-funds",
  baseSepoliaUsdc: "https://faucet.circle.com",
  sepoliaEth: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
} as const;

export async function openFaucet(url: string, address: Address): Promise<void> {
  await Clipboard.setStringAsync(address);
  await Linking.openURL(url);
}
