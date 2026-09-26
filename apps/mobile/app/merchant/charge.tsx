import type { LocalAccount } from "@tap/core";
import { formatAmount } from "@tap/core";
import { createFakeCore } from "@tap/core/testing";
import { useCharge } from "@tap/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { QrCode } from "../../src/components/QrCode";
import { StatusView } from "../../src/components/StatusView";
import { copy } from "../../src/copy";
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

function ActionButton({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function ChargeView({ account, amount }: { account: LocalAccount; amount: bigint }) {
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

  useEffect(() => {
    if (charge.state === "cancelled") router.back();
  }, [charge.state, router]);

  if (charge.state === "waiting") {
    return (
      <View style={styles.container}>
        {settings.demoTamper ? <Text style={styles.tamperChip}>DEMO: tampered tag</Text> : null}
        <Text style={styles.amount}>{display}</Text>
        {settings.transport === "qr" && charge.url ? (
          <QrCode value={charge.url} />
        ) : (
          <Text style={styles.prompt}>Hold your phone out to the customer</Text>
        )}
        {countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}
        <ActionButton label="Cancel" onPress={() => void charge.cancel()} />
      </View>
    );
  }

  if (charge.state === "paid") {
    return (
      <StatusView variant="success" title={`Paid ${display}`.trim()}>
        {charge.txHash ? (
          <Text style={styles.txHash} selectable>
            {`${charge.txHash.slice(0, 10)}…${charge.txHash.slice(-8)}`}
          </Text>
        ) : null}
        <ActionButton label="New charge" onPress={() => router.replace("/merchant")} />
      </StatusView>
    );
  }

  if (charge.state === "expired") {
    return (
      <StatusView variant="neutral" title="Request expired">
        <ActionButton
          label="Try again"
          onPress={() => {
            charge.reset();
            void charge.start(amount);
          }}
        />
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
        <ActionButton
          label="Try again"
          onPress={() => {
            charge.reset();
            void charge.start(amount);
          }}
        />
      </StatusView>
    );
  }

  return <StatusView variant="pending" title="Preparing…" />;
}

export default function MerchantChargeScreen() {
  const { amount } = useLocalSearchParams<{ amount: string }>();
  const { account } = useWallet();

  if (!/^\d+$/.test(amount ?? "")) {
    return <StatusView variant="failure" title="Charge failed" detail={copy.getErrorMessage()} />;
  }
  if (!account) return <StatusView variant="pending" title="Preparing…" />;

  return <ChargeView account={account} amount={BigInt(amount)} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: theme.spacing * 2,
    justifyContent: "center",
    padding: theme.spacing * 3,
  },
  amount: { color: theme.colors.foreground, fontSize: 56, fontWeight: "700" },
  prompt: { color: theme.colors.muted, fontSize: 18, textAlign: "center" },
  countdown: { color: theme.colors.muted, fontSize: 16 },
  txHash: { color: theme.colors.muted, fontSize: 14 },
  tamperChip: {
    backgroundColor: theme.colors.failure,
    borderRadius: 999,
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: theme.spacing * 1.5,
    paddingVertical: theme.spacing / 2,
  },
  button: {
    borderColor: theme.colors.muted,
    borderRadius: theme.spacing,
    borderWidth: 1,
    marginTop: theme.spacing,
    paddingHorizontal: theme.spacing * 3,
    paddingVertical: theme.spacing * 1.5,
  },
  buttonText: { color: theme.colors.foreground, fontSize: 16, fontWeight: "600" },
});
