import { StyleSheet, Text, View } from "react-native";

export function StatusView({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: 12, padding: 24 },
  title: { fontSize: 32, fontWeight: "700" },
  detail: { color: "#4b5563", fontSize: 16 },
});
