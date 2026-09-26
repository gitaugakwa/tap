import "react-native-get-random-values";

import { configureTap } from "@tap/core";
import { Stack } from "expo-router";
import { WalletProvider } from "../src/wallet/WalletProvider";

configureTap({
  rpcUrls: {
    payment: process.env.EXPO_PUBLIC_BASE_SEPOLIA_RPC,
    ens: process.env.EXPO_PUBLIC_SEPOLIA_RPC,
  },
});

export default function RootLayout() {
  return (
    <WalletProvider>
      <Stack screenOptions={{ headerTitle: "Tap" }} />
    </WalletProvider>
  );
}
