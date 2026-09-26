import { parseAmountInput } from "@tap/core";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AmountPad } from "../../src/components/AmountPad";
import { Button } from "../../src/components/Button";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { SetupBanner } from "../../src/components/SetupBanner";
import { copy } from "../../src/copy";
import { useSettings } from "../../src/settings-store";
import { theme } from "../../src/theme";
import { useWallet } from "../../src/wallet/WalletProvider";

export default function MerchantAmountScreen() {
  const router = useRouter();
  const [settings] = useSettings();
  const { address } = useWallet();
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
      <ScreenHeader label="Merchant" value={settings.merchantName} />

      {address ? <SetupBanner merchantName={settings.merchantName} address={address} /> : null}

      <View style={styles.amountBlock}>
        <Text style={styles.amountLabel}>{copy.labels.charge}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currency}>$</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {display}
          </Text>
        </View>
      </View>

      <AmountPad value={input} onChange={setInput} />

      {amountError ? <Text style={styles.error}>{amountError}</Text> : null}

      <View style={styles.footer}>
        <Button label={`Charge $${display}`} disabled={isZero} onPress={charge} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing * 2,
    padding: theme.spacing * 3,
  },
  amountBlock: { gap: theme.spacing / 2, marginTop: theme.spacing },
  amountLabel: { ...theme.type.label, color: theme.colors.muted, fontSize: 10 },
  amountRow: { alignItems: "flex-start", flexDirection: "row", gap: theme.spacing / 2 },
  currency: { ...theme.type.display, color: theme.colors.accent, fontSize: 30, paddingTop: 12 },
  amount: {
    ...theme.type.display,
    color: theme.colors.foreground,
    flexShrink: 1,
    fontSize: 76,
    lineHeight: 80,
  },
  error: { color: theme.colors.failure, fontSize: 14, textAlign: "center" },
  footer: { marginTop: "auto" },
});
