import type { LocalAccount } from "@tap/core";
import { createFakeCore } from "@tap/core/testing";
import { useTapToPay } from "@tap/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MerchantCard } from "../../src/components/MerchantCard";
import { StatusView } from "../../src/components/StatusView";
import { copy } from "../../src/copy";
import { useSettings } from "../../src/settings-store";
import { theme } from "../../src/theme";
import { useWallet } from "../../src/wallet/WalletProvider";

function DoneButton({ onPress }: { onPress(): void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>Done</Text>
    </Pressable>
  );
}

function ConfirmView({ account, url }: { account: LocalAccount; url: string }) {
  const router = useRouter();
  const [settings] = useSettings();
  const core = useMemo(
    () => (settings.fakeChain ? createFakeCore() : undefined),
    [settings.fakeChain],
  );
  const pay = useTapToPay({ account, core });
  const submitted = useRef(false);
  const { submitUrl } = pay;

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    void submitUrl(url);
  }, [url, submitUrl]);

  const done = () => router.replace("/customer");

  // INV-17: the ONLY branch that may render a Pay button or reach confirm().
  // The guard narrows verify to its ok:true variant, so displayAmount and
  // ensName are unreachable outside it.
  if (pay.state === "verified" && pay.verify?.ok === true) {
    const verified = pay.verify;
    return (
      <View style={styles.container}>
        <MerchantCard
          displayName={verified.displayName}
          ensName={verified.ensName}
          amount={verified.displayAmount}
          expiresAt={verified.expiresAt}
        />
        <Pressable style={styles.payButton} onPress={() => void pay.confirm()}>
          <Text style={styles.payButtonText}>Pay {verified.displayAmount}</Text>
        </Pressable>
      </View>
    );
  }

  if (pay.state === "rejected") {
    return (
      <StatusView
        variant="failure"
        title="Unverified merchant"
        detail={copy.getErrorMessage(pay.verify?.ok === false ? pay.verify.reason : null)}
      >
        <DoneButton onPress={done} />
      </StatusView>
    );
  }

  const settled = pay.verify?.ok === true ? pay.verify : null;

  if (pay.state === "paying") {
    return <StatusView variant="pending" title={settled?.displayAmount ?? ""} detail="Paying…" />;
  }

  if (pay.state === "paid") {
    const merchant = settled ? (settled.displayName ?? settled.ensName) : "";
    return (
      <StatusView
        variant="success"
        title={`Paid ${merchant} ${settled?.displayAmount ?? ""}`.replace(/\s+/g, " ").trim()}
      >
        <DoneButton onPress={done} />
      </StatusView>
    );
  }

  if (pay.state === "failed") {
    return (
      <StatusView
        variant="failure"
        title="Payment failed"
        detail={copy.getErrorMessage(pay.error?.code)}
      >
        <DoneButton onPress={done} />
      </StatusView>
    );
  }

  if (pay.state === "error") {
    return (
      <StatusView
        variant="failure"
        title="Couldn't read the tag"
        detail={copy.getErrorMessage(pay.error?.code)}
      >
        <DoneButton onPress={done} />
      </StatusView>
    );
  }

  return <StatusView variant="pending" title="Checking merchant…" />;
}

export default function CustomerConfirmScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const { account } = useWallet();

  if (!url) {
    return (
      <StatusView
        variant="failure"
        title="Unverified merchant"
        detail={copy.getErrorMessage("malformed")}
      />
    );
  }
  if (!account) return <StatusView variant="pending" title="Checking merchant…" />;

  return <ConfirmView account={account} url={url} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: theme.spacing * 3,
    justifyContent: "center",
    padding: theme.spacing * 3,
  },
  payButton: {
    backgroundColor: theme.colors.foreground,
    borderRadius: theme.spacing * 1.5,
    padding: theme.spacing * 2.5,
  },
  payButtonText: {
    color: theme.colors.background,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  secondaryButton: {
    borderColor: theme.colors.muted,
    borderRadius: theme.spacing,
    borderWidth: 1,
    marginTop: theme.spacing,
    paddingHorizontal: theme.spacing * 3,
    paddingVertical: theme.spacing * 1.5,
  },
  secondaryButtonText: { color: theme.colors.foreground, fontSize: 16, fontWeight: "600" },
});
