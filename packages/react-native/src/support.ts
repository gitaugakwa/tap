import { Platform } from "react-native";
import NfcManager from "react-native-nfc-manager";

export type NfcSupport = {
  supported: boolean;
  enabled: boolean;
  canEmulate: boolean;
};

export async function getNfcSupport(): Promise<NfcSupport> {
  const supported = await NfcManager.isSupported();
  if (!supported) {
    return { supported: false, enabled: false, canEmulate: false };
  }

  return {
    supported: true,
    enabled: await NfcManager.isEnabled(),
    canEmulate: Platform.OS === "android",
  };
}
