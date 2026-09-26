const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

const CARD_SERVICE = "com.reactnativehce.services.CardService";
const NFC_PERMISSION = "android.permission.NFC";
const NDEF_DISCOVERED = "android.nfc.action.NDEF_DISCOVERED";

const aidList = `<?xml version="1.0" encoding="utf-8"?>
<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/app_name"
    android:requireDeviceUnlock="false">
  <aid-group android:category="other" android:description="@string/app_name">
    <aid-filter android:name="D2760000850101" />
  </aid-group>
</host-apdu-service>
`;

function withHceManifest(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    AndroidConfig.Permissions.ensurePermission(manifestConfig.modResults, NFC_PERMISSION);

    manifest["uses-feature"] = manifest["uses-feature"] ?? [];
    const features = manifest["uses-feature"];
    const hceFeature = features.find(
      (feature) => feature.$?.["android:name"] === "android.hardware.nfc.hce",
    );
    if (hceFeature) {
      hceFeature.$["android:required"] = "false";
    } else {
      features.push({
        $: {
          "android:name": "android.hardware.nfc.hce",
          "android:required": "false",
        },
      });
    }

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifestConfig.modResults);
    mainActivity["intent-filter"] = mainActivity["intent-filter"] ?? [];
    mainActivity["intent-filter"] = mainActivity["intent-filter"].filter(
      (filter) => !filter.action?.some((action) => action.$?.["android:name"] === NDEF_DISCOVERED),
    );
    mainActivity["intent-filter"].push({
      action: [{ $: { "android:name": NDEF_DISCOVERED } }],
      category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      data: [
        {
          $: {
            "android:scheme": "https",
            "android:host": "tap-pay.xyz",
            "android:path": "/p",
          },
        },
      ],
    });

    application.service = application.service ?? [];
    application.service = application.service.filter(
      (service) => service.$?.["android:name"] !== CARD_SERVICE,
    );
    application.service.push({
      $: {
        "android:name": CARD_SERVICE,
        "android:exported": "true",
        "android:enabled": "false",
        "android:permission": "android.permission.BIND_NFC_SERVICE",
      },
      "intent-filter": [
        {
          action: [{ $: { "android:name": "android.nfc.cardemulation.action.HOST_APDU_SERVICE" } }],
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        },
      ],
      "meta-data": [
        {
          $: {
            "android:name": "android.nfc.cardemulation.host_apdu_service",
            "android:resource": "@xml/aid_list",
          },
        },
      ],
    });

    return manifestConfig;
  });
}

function withHceAidList(config) {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const xmlDirectory = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      await fs.mkdir(xmlDirectory, { recursive: true });
      await fs.writeFile(path.join(xmlDirectory, "aid_list.xml"), aidList, "utf8");
      return modConfig;
    },
  ]);
}

module.exports = function withHce(config) {
  return withHceAidList(withHceManifest(config));
};
