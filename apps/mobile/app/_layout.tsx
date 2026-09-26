import "react-native-get-random-values";

import { configureTap } from "@tap/core";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSettings } from "../src/settings-store";
import { theme } from "../src/theme";
import { WalletProvider } from "../src/wallet/WalletProvider";

configureTap({
  rpcUrls: {
    payment: process.env.EXPO_PUBLIC_BASE_SEPOLIA_RPC,
    ens: process.env.EXPO_PUBLIC_SEPOLIA_RPC,
  },
});

function FakeChainChip() {
  const [settings] = useSettings();
  if (!settings.fakeChain) return null;

  return (
    <View style={styles.chip} pointerEvents="none">
      <Text style={styles.chipText}>FAKE CHAIN</Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <WalletProvider>
      <Stack screenOptions={{ headerTitle: "Tap" }} />
      <FakeChainChip />
    </WalletProvider>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "center",
    backgroundColor: theme.colors.failure,
    borderRadius: 999,
    paddingHorizontal: theme.spacing * 1.5,
    paddingVertical: theme.spacing / 2,
    position: "absolute",
    top: theme.spacing * 6,
  },
  chipText: { color: theme.colors.background, fontSize: 12, fontWeight: "700" },
});
