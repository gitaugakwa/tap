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
          key={key}
          style={styles.key}
          onPress={() => onChange(nextAmountInput(value, key))}
        >
          <Text style={styles.keyText}>{key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing },
  key: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.muted,
    borderRadius: theme.spacing,
    borderWidth: 1,
    flexBasis: "30%",
    flexGrow: 1,
    paddingVertical: theme.spacing * 2.5,
  },
  keyText: { color: theme.colors.foreground, fontSize: 24, fontWeight: "600" },
});
