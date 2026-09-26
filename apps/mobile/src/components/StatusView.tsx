import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export type StatusVariant = "neutral" | "pending" | "success" | "failure";

const TITLE_COLORS: Record<StatusVariant, string> = {
  neutral: theme.colors.muted,
  pending: theme.colors.foreground,
  success: theme.colors.success,
  failure: theme.colors.failure,
};

export function StatusView({
  title,
  detail,
  variant = "neutral",
  children,
}: {
  title: string;
  detail?: string;
  variant?: StatusVariant;
  children?: ReactNode;
}) {
  return (
    <View style={styles.container}>
      {variant === "pending" ? <ActivityIndicator color={theme.colors.muted} size="large" /> : null}
      {variant === "success" ? <Text style={styles.successGlyph}>✓</Text> : null}
      {variant === "failure" ? <Text style={styles.failureGlyph}>✕</Text> : null}
      <Text style={[styles.title, { color: TITLE_COLORS[variant] }]}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: theme.spacing * 1.5,
    justifyContent: "center",
    padding: theme.spacing * 3,
  },
  title: { fontSize: 32, fontWeight: "700" },
  detail: { color: theme.colors.muted, fontSize: 16 },
  successGlyph: { color: theme.colors.success, fontSize: 72, fontWeight: "700" },
  failureGlyph: { color: theme.colors.failure, fontSize: 72, fontWeight: "700" },
});
