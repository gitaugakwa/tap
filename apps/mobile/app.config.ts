import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Tap",
  slug: "tap",
  scheme: "tap",
  version: "0.0.0",
  orientation: "portrait",
  extra: {
    eas: {
      projectId: "4fc1344e-2791-4e44-9b7f-9f32b91be6dc",
    },
  },
  plugins: ["expo-router", "./plugins/withHce.js"],
  android: {
    package: "xyz.tap.demo",
    permissions: ["android.permission.NFC"],
  },
};

export default config;
