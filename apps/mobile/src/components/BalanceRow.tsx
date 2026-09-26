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
      <Text style={styles.muted}>{unavailable ? "Balances unavailable" : "Loading balances…"}</Text>
    );
  }

  const usdc = balances.tokens.find((token) => token.symbol === "USDC");

  return (
    <View style={styles.row}>
      <Text style={styles.value}>
        {balances.tokens.map((token) => `${token.symbol} ${token.display}`).join(" · ")}
        {` · Gas ${balances.gas.amount > 0n ? "✓" : "✗"}`}
      </Text>
      {balances.gas.amount === 0n ? (
        <Text style={styles.warning}>Add Base Sepolia ETH for gas</Text>
      ) : null}
      {usdc && usdc.amount === 0n ? <Text style={styles.warning}>Add USDC to pay</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: theme.spacing / 2 },
  value: { color: theme.colors.foreground, fontSize: 16 },
  muted: { color: theme.colors.muted, fontSize: 16 },
  warning: { color: theme.colors.warning, fontSize: 14 },
});
