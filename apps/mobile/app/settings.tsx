import type { WalletBalances } from "@tap/core";
import {
  DEFAULT_TOKEN,
  ENS_CHAIN_ID,
  getPaymentChain,
  getWalletBalances,
  PAYMENT_CHAIN_ID,
} from "@tap/core";
import type { TamperField } from "@tap/core/testing";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSettings } from "../src/settings-store";
import { theme } from "../src/theme";
import { useWallet } from "../src/wallet/WalletProvider";

const FAKE_BALANCES: WalletBalances = {
  gas: { symbol: "ETH", amount: 50_000_000_000_000_000n, display: "0.05" },
  tokens: [{ address: DEFAULT_TOKEN, symbol: "USDC", amount: 12_000_000n, display: "$12.00" }],
};

const TAMPER_FIELDS: TamperField[] = ["m", "n", "t", "a", "x", "k", "c"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
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
      "This permanently deletes this device's key and creates a new one. Registered merchant names and funds stay linked to the old wallet and cannot be recovered here.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: () => void resetWallet() },
      ],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Settings</Text>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

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
        <Pressable
          accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={() => router.push("/merchant/register")}
        >
          <Text style={styles.secondaryButtonText}>Register this wallet</Text>
        </Pressable>
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

      <Section title="Demo">
        <Text style={styles.muted}>
          Serves a tampered tag so the customer phone shows "Unverified merchant". For the failure
          demo only.
        </Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.segment, settings.demoTamper === null && styles.segmentActive]}
            onPress={() => setSettings({ demoTamper: null })}
          >
            <Text
              style={[styles.segmentText, settings.demoTamper === null && styles.segmentTextActive]}
            >
              Off
            </Text>
          </Pressable>
          {TAMPER_FIELDS.map((field) => (
            <Pressable
              key={field}
              style={[styles.segment, settings.demoTamper === field && styles.segmentActive]}
              onPress={() => setSettings({ demoTamper: field })}
            >
              <Text
                style={[
                  styles.segmentText,
                  settings.demoTamper === field && styles.segmentTextActive,
                ]}
              >
                {field}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="Developer">
        <View style={styles.switchRow}>
          <Text style={styles.value}>Offline fake chain</Text>
          <Switch
            value={settings.fakeChain}
            onValueChange={(fakeChain) => setSettings({ fakeChain })}
          />
        </View>
      </Section>

      <Section title="About">
        <Text style={styles.muted}>Version {Constants.expoConfig?.version ?? "unknown"}</Text>
        <Text style={styles.muted}>
          Payment chain {PAYMENT_CHAIN_ID} · ENS chain {ENS_CHAIN_ID}
        </Text>
        <Text style={styles.muted} selectable>
          TapPay {getPaymentChain(PAYMENT_CHAIN_ID)?.tapPay ?? "not deployed"}
        </Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.colors.background },
  screenHeader: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" },
  screenTitle: { ...theme.type.display, color: theme.colors.foreground, fontSize: 34 },
  close: { ...theme.type.label, color: theme.colors.muted, fontSize: 11 },
  container: {
    backgroundColor: theme.colors.background,
    gap: theme.spacing * 3.5,
    padding: theme.spacing * 3,
    paddingBottom: theme.spacing * 6,
  },
  section: { gap: theme.spacing * 1.25 },
  sectionTitle: {
    ...theme.type.label,
    borderBottomColor: theme.colors.line,
    borderBottomWidth: 1,
    color: theme.colors.muted,
    fontSize: 10,
    paddingBottom: theme.spacing,
  },
  address: { color: theme.colors.foreground, fontSize: 13, lineHeight: 19 },
  value: { color: theme.colors.foreground, fontSize: 15 },
  muted: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  input: {
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.foreground,
    fontSize: 16,
    padding: theme.spacing * 1.5,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing / 1.5 },
  switchRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  segment: {
    alignItems: "center",
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 46,
    paddingVertical: theme.spacing * 1.25,
  },
  segmentActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  segmentText: { ...theme.type.label, color: theme.colors.muted, fontSize: 11 },
  segmentTextActive: { color: theme.colors.accentText },
  secondaryButton: {
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    padding: theme.spacing * 1.5,
  },
  secondaryButtonText: {
    ...theme.type.label,
    color: theme.colors.foreground,
    fontSize: 11,
    textAlign: "center",
  },
  destructiveButton: {
    borderColor: theme.colors.failure,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    padding: theme.spacing * 1.5,
  },
  destructiveButtonText: {
    ...theme.type.label,
    color: theme.colors.failure,
    fontSize: 11,
    textAlign: "center",
  },
});
