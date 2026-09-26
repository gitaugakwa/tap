import { cancelRead, readRequest, startCharge, stopCharge } from "@tap/react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

const SPIKE_URL = "https://tap-pay.xyz/p?v=1&test=1";
const READ_TIMEOUT_MS = 30_000;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown NFC error";
}

export default function NfcSpikeScreen() {
  const mountedRef = useRef(true);
  const [isServing, setIsServing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [status, setStatus] = useState("SDK transport ready");
  const [readUrl, setReadUrl] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stopCharge();
      void cancelRead();
    };
  }, []);

  async function toggleHce() {
    try {
      if (isServing) {
        await stopCharge();
        if (mountedRef.current) {
          setIsServing(false);
          setStatus("HCE stopped");
        }
        return;
      }

      await startCharge(SPIKE_URL);
      if (!mountedRef.current) {
        await stopCharge();
        return;
      }

      setIsServing(true);
      setStatus("HCE serving the test URL");
    } catch (error) {
      if (mountedRef.current) {
        setStatus(`HCE error: ${errorMessage(error)}`);
      }
    }
  }

  async function readTag() {
    setIsReading(true);
    setReadUrl(null);
    setStatus("Hold this phone near the HCE phone");

    try {
      const url = await readRequest({ timeoutMs: READ_TIMEOUT_MS });
      if (mountedRef.current) {
        setReadUrl(url);
        setStatus("Tag read successfully");
      }
    } catch (error) {
      if (mountedRef.current) {
        setStatus(`Read error: ${errorMessage(error)}`);
      }
    } finally {
      if (mountedRef.current) {
        setIsReading(false);
      }
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>F2 SDK TRANSPORT TEST</Text>
        <Text style={styles.title}>NFC SDK smoke</Text>
        <Text style={styles.url}>{SPIKE_URL}</Text>

        <Pressable style={[styles.button, isServing && styles.stopButton]} onPress={toggleHce}>
          <Text style={styles.buttonText}>{isServing ? "Stop HCE" : "Serve test URL"}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={readTag} disabled={isReading}>
          <Text style={styles.secondaryButtonText}>
            {isReading ? "Reading..." : "Read NFC tag"}
          </Text>
        </Pressable>

        <View style={styles.result}>
          <Text style={styles.resultLabel}>STATUS</Text>
          <Text style={styles.status}>{status}</Text>
          {readUrl ? <Text style={styles.readUrl}>{readUrl}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3efe6" },
  panel: { flex: 1, justifyContent: "center", gap: 16, padding: 24 },
  eyebrow: { color: "#8a4b2d", fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  title: { color: "#17130f", fontSize: 42, fontWeight: "700" },
  url: { color: "#655b50", fontFamily: "monospace", marginBottom: 12 },
  button: { alignItems: "center", backgroundColor: "#17130f", borderRadius: 12, padding: 18 },
  stopButton: { backgroundColor: "#9f2f22" },
  buttonText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#17130f",
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  secondaryButtonText: { color: "#17130f", fontSize: 17, fontWeight: "700" },
  result: { backgroundColor: "#ffffff", borderRadius: 12, gap: 8, marginTop: 12, padding: 18 },
  resultLabel: { color: "#8a4b2d", fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  status: { color: "#17130f", fontSize: 16 },
  readUrl: { color: "#17663a", fontFamily: "monospace", fontSize: 15 },
});
