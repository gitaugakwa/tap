import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"] as const;

const MAX_INTEGER_DIGITS = 9;
const MAX_FRACTION_DIGITS = 2;

export function nextAmountInput(value: string, key: string): string {
  if (key === "⌫") return value.slice(0, -1);

  if (key === ".") {
    if (value.includes(".")) return value;
    return value === "" ? "0." : `${value}.`;
  }

  const [integer = "", fraction] = value.split(".");
  if (fraction !== undefined) {
    return fraction.length >= MAX_FRACTION_DIGITS ? value : `${value}${key}`;
  }
  if (value === "0") return key === "0" ? value : key;
  return integer.length >= MAX_INTEGER_DIGITS ? value : `${value}${key}`;
}

export function AmountPad({ value, onChange }: { value: string; onChange(next: string): void }) {
  return (
    <View style={styles.pad}>
      {KEYS.map((key) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={key === "⌫" ? "Delete" : key}
          key={key}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          onPress={() => onChange(nextAmountInput(value, key))}
        >
          {({ pressed }) => (
            <Text
              style={[
                styles.keyText,
                key === "⌫" && styles.keyTextMuted,
                pressed && styles.keyTextPressed,
              ]}
            >
              {key}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing },
  key: {
    alignItems: "center",
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexBasis: "30%",
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: theme.spacing * 2.25,
  },
  keyPressed: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  keyText: { ...theme.type.display, color: theme.colors.foreground, fontSize: 28 },
  keyTextMuted: { color: theme.colors.muted, fontSize: 22 },
  keyTextPressed: { color: theme.colors.accentText },
});
