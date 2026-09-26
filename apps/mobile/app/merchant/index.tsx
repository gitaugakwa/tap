import { parseAmountInput } from "@tap/core";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AmountPad } from "../../src/components/AmountPad";
import { copy } from "../../src/copy";
import { useSettings } from "../../src/settings-store";
import { theme } from "../../src/theme";

export default function MerchantAmountScreen() {
  const router = useRouter();
  const [settings] = useSettings();
  const [input, setInput] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

  const display = input === "" ? "0" : input;
  const isZero = !/[1-9]/.test(input);

  function charge() {
    try {
      const amount = parseAmountInput(input);
      setAmountError(null);
      router.push({ pathname: "/merchant/charge", params: { amount: amount.toString() } });
    } catch {
      setAmountError(copy.getErrorMessage());
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.merchantName}>{settings.merchantName}</Text>
        <Link href="/settings" style={styles.settingsLink}>
          ⚙︎
        </Link>
      </View>

      <Text style={styles.amount}>${display}</Text>

      <AmountPad value={input} onChange={setInput} />

      {amountError ? <Text style={styles.error}>{amountError}</Text> : null}

      <Pressable
        style={[styles.chargeButton, isZero && styles.chargeButtonDisabled]}
        disabled={isZero}
        onPress={charge}
      >
        <Text style={styles.chargeButtonText}>Charge ${display}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: theme.spacing * 2, padding: theme.spacing * 3 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  merchantName: { color: theme.colors.foreground, fontSize: 16, fontWeight: "600" },
  settingsLink: { color: theme.colors.muted, fontSize: 20 },
  amount: {
    color: theme.colors.foreground,
    fontSize: 56,
    fontWeight: "700",
    marginVertical: theme.spacing * 2,
    textAlign: "center",
  },
  error: { color: theme.colors.failure, fontSize: 14, textAlign: "center" },
  chargeButton: {
    backgroundColor: theme.colors.foreground,
    borderRadius: theme.spacing * 1.5,
    marginTop: "auto",
    padding: theme.spacing * 2.5,
  },
  chargeButtonDisabled: { opacity: 0.4 },
  chargeButtonText: {
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
