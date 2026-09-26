import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function RolePickerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tap</Text>
      <Text style={styles.subtitle}>Pay and get paid with a tap</Text>
      <Link href="/merchant" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>I'm selling</Text>
        </Pressable>
      </Link>
      <Link href="/customer" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>I'm paying</Text>
        </Pressable>
      </Link>
      <Link href="/settings">Settings</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: 16, padding: 24 },
  title: { fontSize: 48, fontWeight: "700" },
  subtitle: { color: "#4b5563", fontSize: 18, marginBottom: 24 },
  button: { backgroundColor: "#111827", borderRadius: 12, padding: 18 },
  buttonText: { color: "#ffffff", fontSize: 18, fontWeight: "600", textAlign: "center" },
});
