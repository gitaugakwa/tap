import "react-native-get-random-values";

import { Stack } from "expo-router";
import { useEffect } from "react";
import { resetHceSession } from "../src/hce-session";

export default function RootLayout() {
  useEffect(() => {
    void resetHceSession().catch(() => undefined);
  }, []);

  return <Stack screenOptions={{ headerTitle: "Tap" }} />;
}
