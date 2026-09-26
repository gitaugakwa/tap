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

function initialOf(name: string): string {
  const match = name.match(/[a-z0-9]/i);
  return match ? match[0].toUpperCase() : "·";
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
  const name = displayName ?? ensName;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.headLabel}>{copy.labels.identityCheck}</Text>
        <Text style={styles.liveChip}>{copy.labels.live}</Text>
      </View>

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialOf(name)}</Text>
        </View>
        <View style={styles.names}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.ensName} numberOfLines={1}>
            {copy.ensVerifiedLabel(ensName)}
          </Text>
        </View>
      </View>

      <View style={styles.amountBlock}>
        <Text style={styles.amountLabel}>{copy.labels.amountDue}</Text>
        <Text style={styles.amount}>{amount}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.verifiedChip}>{copy.labels.verifiedToPay}</Text>
        {expiryLabel ? <Text style={styles.expiry}>{expiryLabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    gap: theme.spacing * 2,
    padding: theme.spacing * 2.5,
  },
  head: { flexDirection: "row", justifyContent: "space-between" },
  headLabel: { ...theme.type.label, color: theme.colors.onSurfaceMuted, fontSize: 10 },
  liveChip: {
    ...theme.type.label,
    backgroundColor: theme.colors.success,
    color: theme.colors.successText,
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  identity: { alignItems: "center", flexDirection: "row", gap: theme.spacing * 1.5 },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.colors.warning,
    borderRadius: theme.radius.pill,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  avatarText: { ...theme.type.display, color: theme.colors.surface, fontSize: 26 },
  names: { flexShrink: 1, gap: 3 },
  name: { ...theme.type.display, color: theme.colors.onSurface, fontSize: 28, lineHeight: 32 },
  ensName: { color: theme.colors.successText, fontSize: 13, fontWeight: "600" },
  amountBlock: {
    borderTopColor: "rgba(23, 23, 19, 0.18)",
    borderTopWidth: 1,
    gap: 2,
    paddingTop: theme.spacing * 1.5,
  },
  amountLabel: { ...theme.type.label, color: theme.colors.onSurfaceMuted, fontSize: 9 },
  amount: { ...theme.type.display, color: theme.colors.onSurface, fontSize: 60, lineHeight: 64 },
  footer: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  verifiedChip: {
    ...theme.type.label,
    backgroundColor: theme.colors.success,
    color: theme.colors.successText,
    fontSize: 10,
    paddingHorizontal: theme.spacing,
    paddingVertical: 5,
  },
  expiry: { color: theme.colors.onSurfaceMuted, fontSize: 12 },
});
