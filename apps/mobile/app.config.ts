import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Tap",
  slug: "tap",
  scheme: "tap",
  version: "0.0.3",
  orientation: "portrait",
  icon: "./assets/icon.png",
  backgroundColor: "#171713",
  userInterfaceStyle: "dark",
  extra: {
    eas: {
      projectId: "4fc1344e-2791-4e44-9b7f-9f32b91be6dc",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-camera", { recordAudioAndroid: false }],
    "./plugins/withHce.js",
  ],
  android: {
    package: "xyz.tap.demo",
    versionCode: 2,
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
