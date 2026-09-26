import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import { Button } from "./Button";

export function QrScanner({ onScan, onCancel }: { onScan(url: string): void; onCancel(): void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  if (!permission?.granted) {
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionLabel}>Camera</Text>
        <Text style={styles.permissionText}>Tap needs the camera to scan the merchant's code.</Text>
        <Button label="Allow camera" onPress={() => void requestPermission()} />
        <Button label="Cancel" variant="quiet" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.scanner}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          handled.current = true;
          onScan(data);
        }}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.reticle} />
        <Text style={styles.hint}>Point at the merchant's code</Text>
      </View>
      <View style={styles.overlayActions}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scanner: { backgroundColor: theme.colors.background, flex: 1 },
  permission: {
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing * 2,
    justifyContent: "center",
    padding: theme.spacing * 3,
  },
  permissionLabel: { ...theme.type.label, color: theme.colors.muted, fontSize: 10 },
  permissionText: {
    ...theme.type.display,
    color: theme.colors.foreground,
    fontSize: 26,
    lineHeight: 32,
    marginBottom: theme.spacing,
  },
  overlay: { alignItems: "center", flex: 1, gap: theme.spacing * 2, justifyContent: "center" },
  reticle: {
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    height: 240,
    width: 240,
  },
  hint: {
    ...theme.type.label,
    backgroundColor: theme.colors.background,
    color: theme.colors.foreground,
    fontSize: 10,
    paddingHorizontal: theme.spacing * 1.5,
    paddingVertical: theme.spacing,
  },
  overlayActions: {
    bottom: theme.spacing * 5,
    left: theme.spacing * 3,
    position: "absolute",
    right: theme.spacing * 3,
  },
});
