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
  okBanner: { alignItems: "center", flexDirection: "row", gap: theme.spacing, flexWrap: "wrap" },
  displayName: { ...theme.type.display, color: theme.colors.foreground, fontSize: 22 },
  okText: {
    ...theme.type.label,
    backgroundColor: theme.colors.success,
    color: theme.colors.successText,
    fontSize: 9,
    paddingHorizontal: theme.spacing,
    paddingVertical: 4,
  },
  warningBanner: {
    borderColor: theme.colors.warning,
    borderLeftWidth: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing / 2,
    padding: theme.spacing * 1.5,
  },
  warningText: { color: theme.colors.warning, fontSize: 13, lineHeight: 19 },
  fixLink: { ...theme.type.label, color: theme.colors.warning, fontSize: 10 },
});
