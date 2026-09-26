import type { Address, WalletBalances } from "@tap/core";
import { DEFAULT_TOKEN, getWalletBalances } from "@tap/core";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSettings } from "../settings-store";
import { theme } from "../theme";

const FAKE_BALANCES: WalletBalances = {
  gas: { symbol: "ETH", amount: 50_000_000_000_000_000n, display: "0.05" },
  tokens: [{ address: DEFAULT_TOKEN, symbol: "USDC", amount: 12_000_000n, display: "$12.00" }],
};

export function BalanceRow({ address }: { address: Address }) {
  const [settings] = useSettings();
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (settings.fakeChain) {
      setBalances(FAKE_BALANCES);
      setUnavailable(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const next = await getWalletBalances(address);
        if (cancelled) return;
        setBalances(next);
        setUnavailable(false);
      } catch {
        if (cancelled) return;
        setBalances(null);
        setUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, settings.fakeChain]);

  if (!balances) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>
          {unavailable ? "Balances unavailable" : "Loading balances…"}
        </Text>
      </View>
    );
  }

  const usdc = balances.tokens.find((token) => token.symbol === "USDC");

  return (
    <View style={styles.card}>
      <View style={styles.assets}>
        {balances.tokens.map((token) => (
          <View key={token.address} style={styles.asset}>
            <Text style={styles.assetLabel}>{token.symbol}</Text>
            <Text style={styles.assetValue}>{token.display}</Text>
          </View>
        ))}
        <View style={styles.asset}>
          <Text style={styles.assetLabel}>{balances.gas.symbol}</Text>
          <Text style={styles.assetValue}>{balances.gas.display}</Text>
        </View>
      </View>
      {balances.gas.amount === 0n ? (
        <Text style={styles.warning}>Add Base Sepolia ETH for gas</Text>
      ) : null}
      {usdc && usdc.amount === 0n ? <Text style={styles.warning}>Add USDC to pay</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing,
    padding: theme.spacing * 1.5,
  },
  assets: { flexDirection: "row", gap: theme.spacing * 3 },
  asset: { gap: 2 },
  assetLabel: { ...theme.type.label, color: theme.colors.muted, fontSize: 9 },
  assetValue: { color: theme.colors.foreground, fontSize: 17, fontWeight: "600" },
  muted: { color: theme.colors.muted, fontSize: 14 },
  warning: { color: theme.colors.warning, fontSize: 13 },
});
