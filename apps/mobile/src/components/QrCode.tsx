import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { theme } from "../theme";

export function QrCode({ value, size = 240 }: { value: string; size?: number }) {
  return (
    <View style={styles.frame}>
      <QRCode
        value={value}
        size={size}
        color={theme.colors.onSurface}
        backgroundColor={theme.colors.surface}
        quietZone={12}
        ecl="M"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing,
  },
});
