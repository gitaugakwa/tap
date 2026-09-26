import { cancelRead, readRequest, TransportError } from "@tap/react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { BalanceRow } from "../../src/components/BalanceRow";
import { Button } from "../../src/components/Button";
import { QrScanner } from "../../src/components/QrScanner";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { copy } from "../../src/copy";
import { hapticTap } from "../../src/haptics";
import { useSettings } from "../../src/settings-store";
import { theme } from "../../src/theme";
import { useWallet } from "../../src/wallet/WalletProvider";

const READ_TIMEOUT_MS = 30_000;

function codeOf(error: unknown): string | null {
  return error instanceof TransportError ? error.code : null;
}

function ReadyPulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1_200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1_200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
        },
      ]}
    >
      <Text style={styles.pulseWaves}>)))</Text>
    </Animated.View>
  );
}

export default function CustomerReadyScreen() {
  const router = useRouter();
  const [settings] = useSettings();
  const { address } = useWallet();
  const [readError, setReadError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const blurredRef = useRef(false);

  const startRead = useCallback(async () => {
    setReadError(null);
    try {
      const url = await readRequest({ timeoutMs: READ_TIMEOUT_MS });
      if (blurredRef.current) return;
      hapticTap();
      router.push({ pathname: "/customer/confirm", params: { url } });
    } catch (error) {
      if (blurredRef.current) return;
      setReadError(copy.getErrorMessage(codeOf(error)));
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      if (settings.transport !== "nfc") return;

      blurredRef.current = false;
      void startRead();

      return () => {
        blurredRef.current = true;
        void cancelRead();
      };
    }, [settings.transport, startRead]),
  );

  if (scanning) {
    return (
      <QrScanner
        onScan={(url) => {
          hapticTap();
          setScanning(false);
          router.push({ pathname: "/customer/confirm", params: { url } });
        }}
        onCancel={() => setScanning(false)}
      />
    );
  }

  const isWaiting = settings.transport === "nfc" && !readError;

  return (
    <View style={styles.container}>
      <ScreenHeader
        label={copy.labels.yourWallet}
        value={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Loading…"}
      />

      {address ? <BalanceRow address={address} /> : null}

      <View style={styles.stage}>
        {isWaiting ? <ReadyPulse /> : null}
        <Text style={styles.prompt}>
          {isWaiting ? "Hold near the merchant's phone" : "Ready when you are"}
        </Text>
        {readError ? <Text style={styles.error}>{readError}</Text> : null}
      </View>

      <View style={styles.footer}>
        {readError ? <Button label="Try again" onPress={() => void startRead()} /> : null}
        <Button
          label="Scan QR instead"
          variant={readError ? "quiet" : "secondary"}
          onPress={() => setScanning(true)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing * 2,
    padding: theme.spacing * 3,
  },
  stage: { alignItems: "center", flex: 1, gap: theme.spacing * 3, justifyContent: "center" },
  pulseRing: {
    alignItems: "center",
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 168,
    justifyContent: "center",
    width: 168,
  },
  pulseWaves: {
    ...theme.type.display,
    color: theme.colors.accent,
    fontSize: 52,
    letterSpacing: -7,
    transform: [{ rotate: "-90deg" }],
  },
  prompt: {
    ...theme.type.display,
    color: theme.colors.foreground,
    fontSize: 32,
    lineHeight: 36,
    textAlign: "center",
  },
  error: { color: theme.colors.warning, fontSize: 14, textAlign: "center" },
  footer: { gap: theme.spacing * 1.5 },
});
