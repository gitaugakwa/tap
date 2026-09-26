import type { Address, MerchantSetupCheck } from "@tap/core";
import { checkMerchantSetup } from "@tap/core";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { copy } from "../copy";
import { theme } from "../theme";

export function SetupBanner({ merchantName, address }: { merchantName: string; address: Address }) {
  const [check, setCheck] = useState<MerchantSetupCheck | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const next = await checkMerchantSetup(merchantName, address);
          if (!cancelled) setCheck(next);
        } catch {
          if (!cancelled) setCheck(null);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [merchantName, address]),
  );

  if (!check) return null;

  if (check.ok) {
    return (
      <View style={styles.okBanner}>
        {check.displayName ? <Text style={styles.displayName}>{check.displayName}</Text> : null}
        <Text style={styles.okText}>{copy.ensVerifiedLabel(merchantName)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.warningBanner}>
      <Text style={styles.warningText}>{copy.getErrorMessage(check.reason)}</Text>
      <Link href="/settings" style={styles.fixLink}>
        How to fix
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  okBanner: { gap: theme.spacing / 2 },
  displayName: { color: theme.colors.foreground, fontSize: 18, fontWeight: "600" },
  okText: { color: theme.colors.success, fontSize: 14, fontWeight: "600" },
  warningBanner: {
    borderColor: theme.colors.warning,
    borderRadius: theme.spacing,
    borderWidth: 1,
    gap: theme.spacing / 2,
    padding: theme.spacing * 1.5,
  },
  warningText: { color: theme.colors.warning, fontSize: 14 },
  fixLink: { color: theme.colors.warning, fontSize: 14, fontWeight: "600" },
});
