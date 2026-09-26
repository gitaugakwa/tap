import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Tap",
  slug: "tap",
  scheme: "tap",
  version: "0.0.0",
  orientation: "portrait",
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-camera", { recordAudioAndroid: false }],
    "./plugins/withHce.js",
  ],
  android: {
    package: "xyz.tap.demo",
    permissions: ["android.permission.NFC"],
  },
};

export default config;
