import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Tap",
  slug: "tap",
  scheme: "tap",
  version: "0.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  backgroundColor: "#171713",
  userInterfaceStyle: "dark",
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-camera", { recordAudioAndroid: false }],
    "./plugins/withHce.js",
  ],
  android: {
    package: "xyz.tap.demo",
    permissions: ["android.permission.NFC"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        category: ["BROWSABLE", "DEFAULT"],
        data: {
          scheme: "https",
          host: "tap-pay.xyz",
          path: "/p",
        },
      },
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#171713",
    },
  },
};

export default config;
