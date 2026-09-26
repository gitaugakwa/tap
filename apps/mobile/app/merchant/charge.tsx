import type { LocalAccount } from "@tap/core";
import { formatAmount, getPaymentChain, PAYMENT_CHAIN_ID } from "@tap/core";
import { createFakeCore } from "@tap/core/testing";
import { useCharge } from "@tap/react-native";
import { useKeepAwake } from "expo-keep-awake";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { QrCode } from "../../src/components/QrCode";
import { StatusView } from "../../src/components/StatusView";
import { copy } from "../../src/copy";
import { hapticFailure, hapticSuccess } from "../../src/haptics";
import { useSettings } from "../../src/settings-store";
import { theme } from "../../src/theme";
import { useWallet } from "../../src/wallet/WalletProvider";

function displayAmount(amount: bigint | undefined): string {
  if (amount === undefined) return "";
  try {
    return formatAmount(amount);
  } catch {
    return "";
  }
}

function useCountdown(expiresAt: Date | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1_000));
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
}

function TapWaves() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1_100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1_100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.Text
      style={[
        styles.waves,
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
          transform: [
            { rotate: "-90deg" },
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
          ],
        },
      ]}
    >
      )))
    </Animated.Text>
  );
}

function ExplorerLink({ txHash }: { txHash: string }) {
  const explorer = getPaymentChain(PAYMENT_CHAIN_ID)?.chain.blockExplorers?.default.url;
  const short = `${txHash.slice(0, 10)}…${txHash.slice(-8)}`;

  if (!explorer) return <Text style={styles.txHash}>{short}</Text>;

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(`${explorer}/tx/${txHash}`)}
    >
      <Text style={styles.txHash}>{short}</Text>
      <Text style={styles.explorerLink}>View on explorer ↗</Text>
    </Pressable>
  );
}

function ChargeView({
  account,
  amount,
  onRetry,
}: {
  account: LocalAccount;
  amount: bigint;
  onRetry(): void;
}) {
  useKeepAwake();
  const router = useRouter();
  const [settings] = useSettings();
  const core = useMemo(
    () => (settings.fakeChain ? createFakeCore() : undefined),
    [settings.fakeChain],
  );
  const charge = useCharge({
    account,
    merchantName: settings.merchantName,
    transport: settings.transport,
    demoTamper: settings.demoTamper,
    core,
  });
  const countdown = useCountdown(charge.expiresAt);
  const display = displayAmount(charge.amount ?? amount);
  const startCharge = useEffectEvent(charge.start);

  useEffect(() => {
    void startCharge(amount);
  }, [amount]);

  useEffect(() => {
    if (charge.state === "cancelled") router.back();
  }, [charge.state, router]);

  useEffect(() => {
    if (charge.state === "paid") hapticSuccess();
    if (charge.state === "error") hapticFailure();
  }, [charge.state]);

  if (charge.state === "waiting") {
    const isQr = settings.transport === "qr" && charge.url;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>{copy.labels.charge}</Text>
          <Text style={styles.signal}>{isQr ? "QR" : copy.labels.nfcSignal}</Text>
        </View>

        {settings.demoTamper ? (
          <Text style={styles.tamperChip}>{copy.labels.tamperDemo}</Text>
        ) : null}

        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>

        <View style={[styles.stage, isQr && styles.stageQr]}>
          {isQr && charge.url ? (
            <QrCode value={charge.url} />
          ) : (
            <>
              <TapWaves />
              <Text style={styles.stageTitle}>{copy.labels.readyToTap}</Text>
              <Text style={styles.stageHint}>Hold your phone out to the customer</Text>
            </>
          )}
        </View>

        <View style={styles.footer}>
          {countdown ? <Text style={styles.countdown}>Expires in {countdown}</Text> : null}
          <Button label="Cancel" variant="quiet" onPress={() => void charge.cancel()} />
        </View>
      </View>
    );
  }

  if (charge.state === "paid") {
    return (
      <StatusView variant="success" title={`Paid ${display}`.trim()}>
        {charge.txHash ? <ExplorerLink txHash={charge.txHash} /> : null}
        <Button label="New charge" onPress={() => router.replace("/merchant")} />
      </StatusView>
    );
  }

  if (charge.state === "expired") {
    return (
      <StatusView variant="neutral" title="Request expired">
        <Button label="Try again" onPress={onRetry} />
        <Button label="Back" variant="quiet" onPress={() => router.replace("/merchant")} />
      </StatusView>
    );
  }

  if (charge.state === "error") {
    return (
      <StatusView
        variant="failure"
        title="Charge failed"
        detail={copy.getErrorMessage(charge.error?.code)}
      >
        <Button label="Try again" onPress={onRetry} />
        <Button label="Back" variant="quiet" onPress={() => router.replace("/merchant")} />
      </StatusView>
    );
  }

  return <StatusView variant="pending" title="Preparing…" />;
}

export default function MerchantChargeScreen() {
  const { amount } = useLocalSearchParams<{ amount: string }>();
  const { account } = useWallet();
  const [attempt, setAttempt] = useState(0);

  if (!/^\d+$/.test(amount ?? "")) {
    return <StatusView variant="failure" title="Charge failed" detail={copy.getErrorMessage()} />;
  }
  if (!account) return <StatusView variant="pending" title="Preparing…" />;

  return (
    <ChargeView
      key={attempt}
      account={account}
      amount={BigInt(amount)}
      onRetry={() => setAttempt((current) => current + 1)}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing * 2,
    padding: theme.spacing * 3,
  },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerLabel: { ...theme.type.label, color: theme.colors.muted, fontSize: 10 },
  signal: { ...theme.type.label, color: theme.colors.accent, fontSize: 11 },
  amount: {
    ...theme.type.display,
    color: theme.colors.foreground,
    fontSize: 72,
    lineHeight: 76,
  },
  stage: {
    alignItems: "center",
    backgroundColor: "#2a2a25",
    borderColor: "#5b5b51",
    borderRadius: theme.radius.md,
    borderStyle: "dashed",
    borderWidth: 1,
    flex: 1,
    gap: theme.spacing,
    justifyContent: "center",
    padding: theme.spacing * 2,
  },
  stageQr: { backgroundColor: theme.colors.background, borderStyle: "solid" },
  waves: {
    ...theme.type.display,
    color: theme.colors.accent,
    fontSize: 44,
    letterSpacing: -6,
    marginBottom: theme.spacing,
  },
  stageTitle: { color: theme.colors.foreground, fontSize: 17, fontWeight: "600" },
  stageHint: { color: theme.colors.muted, fontSize: 13, textAlign: "center" },
  countdown: { ...theme.type.label, color: theme.colors.muted, fontSize: 10, textAlign: "center" },
  footer: { gap: theme.spacing * 1.5 },
  tamperChip: {
    ...theme.type.label,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.failure,
    color: theme.colors.surface,
    fontSize: 9,
    paddingHorizontal: theme.spacing,
    paddingVertical: 4,
  },
  txHash: { color: theme.colors.muted, fontSize: 13, textAlign: "center" },
  explorerLink: {
    ...theme.type.label,
    color: theme.colors.accent,
    fontSize: 10,
    paddingTop: 4,
    textAlign: "center",
  },
});
