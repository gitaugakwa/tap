import { getNfcSupport } from "@tap/react-native";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { copy } from "../src/copy";
import { updateSettings } from "../src/settings-store";
import { theme } from "../src/theme";

export default function RolePickerScreen() {
  const router = useRouter();
  const [canEmulate, setCanEmulate] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getNfcSupport()
      .then((support) => {
        if (!cancelled) setCanEmulate(support.canEmulate);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  function choose(role: "merchant" | "customer") {
    updateSettings({ role });
    router.push(role === "merchant" ? "/merchant" : "/customer");
  }

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>T</Text>
        </View>
        <Text style={styles.brandName}>Tap</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDash} />
          <Text style={styles.eyebrow}>ETHGlobal Tokyo 2026</Text>
        </View>
        <Text style={styles.tagline}>{copy.labels.tagline}</Text>
      </View>

      <View style={styles.actions}>
        <Button label={copy.labels.merchantRole} onPress={() => choose("merchant")} />
        {canEmulate ? null : <Text style={styles.note}>{copy.labels.noEmulation}</Text>}
        <Button
          label={copy.labels.customerRole}
          variant="secondary"
          onPress={() => choose("customer")}
        />
        <Link href="/settings" style={styles.settingsLink}>
          Settings
        </Link>
      </View>
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
  brand: { alignItems: "center", flexDirection: "row", gap: theme.spacing * 1.25 },
  brandMark: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  brandMarkText: { ...theme.type.display, color: theme.colors.onSurface, fontSize: 19 },
  brandName: { ...theme.type.label, color: theme.colors.foreground, fontSize: 18 },
  hero: { gap: theme.spacing * 2 },
  eyebrowRow: { alignItems: "center", flexDirection: "row", gap: theme.spacing },
  eyebrowDash: { backgroundColor: theme.colors.warning, height: 2, width: 25 },
  eyebrow: { ...theme.type.label, color: theme.colors.foreground, fontSize: 10 },
  tagline: { ...theme.type.display, color: theme.colors.foreground, fontSize: 46, lineHeight: 48 },
  actions: { gap: theme.spacing * 1.5 },
  note: { color: theme.colors.warning, fontSize: 13, textAlign: "center" },
  settingsLink: {
    ...theme.type.label,
    color: theme.colors.muted,
    fontSize: 10,
    paddingTop: theme.spacing,
    textAlign: "center",
  },
});
