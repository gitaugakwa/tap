import type { WalletBalances } from "@tap/core";
import { DEFAULT_TOKEN, getWalletBalances } from "@tap/core";
import * as Clipboard from "expo-clipboard";
import { type ReactNode, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSettings } from "../src/settings-store";
import { theme } from "../src/theme";
import { useWallet } from "../src/wallet/WalletProvider";

const FAKE_BALANCES: WalletBalances = {
  gas: { symbol: "ETH", amount: 50_000_000_000_000_000n, display: "0.05" },
  tokens: [{ address: DEFAULT_TOKEN, symbol: "USDC", amount: 12_000_000n, display: "$12.00" }],
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { address, isLoading, resetWallet } = useWallet();
  const [settings, setSettings] = useSettings();
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [balancesUnavailable, setBalancesUnavailable] = useState(false);

  useEffect(() => {
    if (!address) return;

    if (settings.fakeChain) {
      setBalances(FAKE_BALANCES);
      setBalancesUnavailable(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const next = await getWalletBalances(address);
        if (cancelled) return;
        setBalances(next);
        setBalancesUnavailable(false);
      } catch {
        if (cancelled) return;
        setBalances(null);
        setBalancesUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, settings.fakeChain]);

  function confirmResetWallet() {
    Alert.alert(
      "Reset wallet?",
      "This deletes this device's key and creates a new one. Demo only.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: () => void resetWallet() },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Section title="Wallet">
        <Text style={styles.address} selectable>
          {isLoading ? "Loading…" : (address ?? "No wallet")}
        </Text>
        <Pressable
          style={styles.secondaryButton}
          disabled={!address}
          onPress={() => void Clipboard.setStringAsync(address ?? "")}
        >
          <Text style={styles.secondaryButtonText}>Copy address</Text>
        </Pressable>
        {balances ? (
          <Text style={styles.value}>
            {balances.tokens.map((token) => `${token.symbol} ${token.display}`).join(" · ")}
            {` · Gas ${balances.gas.display} ${balances.gas.symbol}`}
          </Text>
        ) : (
          <Text style={styles.muted}>
            {balancesUnavailable ? "Balances unavailable" : "Loading balances…"}
          </Text>
        )}
        <Pressable style={styles.destructiveButton} onPress={confirmResetWallet}>
          <Text style={styles.destructiveButtonText}>Reset wallet</Text>
        </Pressable>
      </Section>

      <Section title="Merchant">
        <TextInput
          style={styles.input}
          value={settings.merchantName}
          onChangeText={(merchantName) => setSettings({ merchantName })}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="yoyogi-market.tap.eth"
        />
      </Section>

      <Section title="Transport">
        <View style={styles.row}>
          {(["nfc", "qr"] as const).map((transport) => (
            <Pressable
              key={transport}
              style={[styles.segment, settings.transport === transport && styles.segmentActive]}
              onPress={() => setSettings({ transport })}
            >
              <Text
                style={[
                  styles.segmentText,
                  settings.transport === transport && styles.segmentTextActive,
                ]}
              >
                {transport === "nfc" ? "NFC" : "QR"}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing * 3, padding: theme.spacing * 3 },
  section: { gap: theme.spacing },
  sectionTitle: { color: theme.colors.foreground, fontSize: 20, fontWeight: "700" },
  address: { color: theme.colors.foreground, fontSize: 14 },
  value: { color: theme.colors.foreground, fontSize: 16 },
  muted: { color: theme.colors.muted, fontSize: 16 },
  input: {
    borderColor: theme.colors.muted,
    borderRadius: theme.spacing,
    borderWidth: 1,
    color: theme.colors.foreground,
    fontSize: 16,
    padding: theme.spacing * 1.5,
  },
  row: { flexDirection: "row", gap: theme.spacing },
  segment: {
    borderColor: theme.colors.muted,
    borderRadius: theme.spacing,
    borderWidth: 1,
    flex: 1,
    padding: theme.spacing * 1.5,
  },
  segmentActive: { backgroundColor: theme.colors.foreground, borderColor: theme.colors.foreground },
  segmentText: { color: theme.colors.foreground, fontWeight: "600", textAlign: "center" },
  segmentTextActive: { color: theme.colors.background },
  secondaryButton: {
    borderColor: theme.colors.muted,
    borderRadius: theme.spacing,
    borderWidth: 1,
    padding: theme.spacing * 1.5,
  },
  secondaryButtonText: { color: theme.colors.foreground, fontWeight: "600", textAlign: "center" },
  destructiveButton: {
    backgroundColor: theme.colors.failure,
    borderRadius: theme.spacing,
    padding: theme.spacing * 1.5,
  },
  destructiveButtonText: { color: theme.colors.background, fontWeight: "600", textAlign: "center" },
});
