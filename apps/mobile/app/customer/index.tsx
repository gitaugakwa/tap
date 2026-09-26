import { cancelRead, readRequest, TransportError } from "@tap/react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BalanceRow } from "../../src/components/BalanceRow";
import { QrScanner } from "../../src/components/QrScanner";
import { copy } from "../../src/copy";
import { useSettings } from "../../src/settings-store";
import { theme } from "../../src/theme";
import { useWallet } from "../../src/wallet/WalletProvider";

const READ_TIMEOUT_MS = 30_000;

function codeOf(error: unknown): string | null {
  return error instanceof TransportError ? error.code : null;
}

export default function CustomerReadyScreen() {
  const router = useRouter();
  const [settings] = useSettings();
  const { address } = useWallet();
  const [readError, setReadError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (settings.transport !== "nfc") return;

      let cancelled = false;
      setReadError(null);

      (async () => {
        try {
          const url = await readRequest({ timeoutMs: READ_TIMEOUT_MS });
          if (!cancelled) router.push({ pathname: "/customer/confirm", params: { url } });
        } catch (error) {
          if (!cancelled) setReadError(copy.getErrorMessage(codeOf(error)));
        }
      })();

      return () => {
        cancelled = true;
        void cancelRead();
      };
    }, [settings.transport, router]),
  );

  if (scanning) {
    return (
      <QrScanner
        onScan={(url) => {
          setScanning(false);
          router.push({ pathname: "/customer/confirm", params: { url } });
        }}
        onCancel={() => setScanning(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.address}>
          {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Loading…"}
        </Text>
        <Link href="/settings" style={styles.settingsLink}>
          ⚙︎
        </Link>
      </View>

      {address ? <BalanceRow address={address} /> : null}

      <Text style={styles.prompt}>Hold near the merchant's phone</Text>

      {readError ? <Text style={styles.error}>{readError}</Text> : null}

      <Pressable style={styles.scanButton} onPress={() => setScanning(true)}>
        <Text style={styles.scanButtonText}>Scan QR instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: theme.spacing * 2, padding: theme.spacing * 3 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  address: { color: theme.colors.foreground, fontSize: 16, fontWeight: "600" },
  settingsLink: { color: theme.colors.muted, fontSize: 20 },
  prompt: {
    color: theme.colors.foreground,
    fontSize: 28,
    fontWeight: "600",
    marginTop: theme.spacing * 4,
    textAlign: "center",
  },
  error: { color: theme.colors.failure, fontSize: 14, textAlign: "center" },
  scanButton: {
    borderColor: theme.colors.muted,
    borderRadius: theme.spacing,
    borderWidth: 1,
    marginTop: "auto",
    padding: theme.spacing * 2,
  },
  scanButtonText: {
    color: theme.colors.foreground,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
