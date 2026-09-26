import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export function QrScanner({ onScan, onCancel }: { onScan(url: string): void; onCancel(): void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  if (!permission?.granted) {
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionText}>Tap needs the camera to scan the merchant's code.</Text>
        <Pressable style={styles.button} onPress={() => void requestPermission()}>
          <Text style={styles.buttonText}>Allow camera</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onCancel}>
          <Text style={styles.buttonText}>Cancel</Text>
        </Pressable>
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
      <Pressable style={[styles.button, styles.overlayButton]} onPress={onCancel}>
        <Text style={styles.buttonText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scanner: { flex: 1 },
  permission: {
    flex: 1,
    gap: theme.spacing * 2,
    justifyContent: "center",
    padding: theme.spacing * 3,
  },
  permissionText: { color: theme.colors.foreground, fontSize: 18, textAlign: "center" },
  button: {
    borderColor: theme.colors.muted,
    borderRadius: theme.spacing,
    borderWidth: 1,
    paddingHorizontal: theme.spacing * 3,
    paddingVertical: theme.spacing * 1.5,
  },
  overlayButton: {
    alignSelf: "center",
    backgroundColor: theme.colors.background,
    bottom: theme.spacing * 6,
    position: "absolute",
  },
  buttonText: {
    color: theme.colors.foreground,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
