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

const EYEBROWS: Record<StatusVariant, string> = {
  neutral: "status",
  pending: "working",
  success: "settled onchain",
  failure: "stopped",
};

function Glyph({ variant }: { variant: StatusVariant }) {
  if (variant === "pending") {
    return (
      <View style={[styles.glyph, styles.glyphPending]}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }
  if (variant === "success") {
    return (
      <View style={[styles.glyph, styles.glyphSuccess]}>
        <Text style={[styles.glyphText, styles.glyphTextSuccess]}>✓</Text>
      </View>
    );
  }
  if (variant === "failure") {
    return (
      <View style={[styles.glyph, styles.glyphFailure]}>
        <Text style={[styles.glyphText, styles.glyphTextFailure]}>✕</Text>
      </View>
    );
  }
  return null;
}

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
      <View style={styles.body}>
        <Glyph variant={variant} />
        <Text style={styles.eyebrow}>{EYEBROWS[variant]}</Text>
        <Text style={[styles.title, { color: TITLE_COLORS[variant] }]}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "space-between",
    padding: theme.spacing * 3,
  },
  body: { alignItems: "center", flex: 1, gap: theme.spacing * 1.5, justifyContent: "center" },
  actions: { gap: theme.spacing, paddingBottom: theme.spacing * 2 },
  glyph: {
    alignItems: "center",
    borderRadius: theme.radius.pill,
    height: 104,
    justifyContent: "center",
    marginBottom: theme.spacing,
    width: 104,
  },
  glyphPending: { borderColor: theme.colors.line, borderWidth: 1 },
  glyphSuccess: { backgroundColor: theme.colors.success },
  glyphFailure: { backgroundColor: theme.colors.failure },
  glyphText: { fontSize: 46, fontWeight: "700" },
  glyphTextSuccess: { color: theme.colors.successText },
  glyphTextFailure: { color: theme.colors.surface },
  eyebrow: { ...theme.type.label, color: theme.colors.muted, fontSize: 10 },
  title: {
    ...theme.type.display,
    fontSize: 38,
    lineHeight: 42,
    textAlign: "center",
  },
  detail: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: "center",
  },
});
