import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export type ButtonVariant = "primary" | "secondary" | "quiet";

export function Button({
  label,
  onPress,
  disabled = false,
  variant = "primary",
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  variant?: ButtonVariant;
}) {
  const body = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "quiet" && styles.quiet,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, variant === "primary" ? styles.onAccent : styles.onDark]}>
        {label}
      </Text>
    </Pressable>
  );

  if (variant !== "primary") return body;

  return (
    <View style={[styles.shadowHost, disabled && styles.disabled]}>
      <View style={styles.shadow} />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  shadowHost: { position: "relative" },
  shadow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    bottom: -theme.shadowOffset,
    left: theme.shadowOffset,
    position: "absolute",
    right: -theme.shadowOffset,
    top: theme.shadowOffset,
  },
  base: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: theme.spacing * 2.5,
    paddingVertical: theme.spacing * 2,
  },
  primary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  secondary: { backgroundColor: "transparent", borderColor: theme.colors.foreground },
  quiet: { backgroundColor: "transparent", borderColor: theme.colors.line },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.35 },
  label: { ...theme.type.label, fontSize: 15, textAlign: "center" },
  onAccent: { color: theme.colors.accentText },
  onDark: { color: theme.colors.foreground },
});
