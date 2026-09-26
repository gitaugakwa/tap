import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { copy } from "../copy";
import { theme } from "../theme";

function useExpiryLabel(expiresAt: Date | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1_000));
  return `Expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
}

export function MerchantCard({
  displayName,
  ensName,
  amount,
  expiresAt,
}: {
  displayName: string | null;
  ensName: string;
  amount: string;
  expiresAt?: Date;
}) {
  const expiryLabel = useExpiryLabel(expiresAt);

  return (
    <View style={styles.card}>
      <Text style={styles.amount}>{amount}</Text>
      <Text style={styles.name}>{displayName ?? ensName}</Text>
      <Text style={styles.ensName}>{copy.ensVerifiedLabel(ensName)}</Text>
      {expiryLabel ? <Text style={styles.expiry}>{expiryLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: theme.spacing },
  amount: { color: theme.colors.foreground, fontSize: 48, fontWeight: "700" },
  name: { color: theme.colors.foreground, fontSize: 32, fontWeight: "600", textAlign: "center" },
  ensName: { color: theme.colors.success, fontSize: 16, fontWeight: "600" },
  expiry: { color: theme.colors.muted, fontSize: 14 },
});
