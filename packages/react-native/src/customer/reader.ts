import NfcManager, { Ndef, NfcAdapter, NfcTech } from "react-native-nfc-manager";
import { TransportError } from "../errors";
import { getNfcSupport } from "../support";

type ActiveRead = {
  cancelled: boolean;
  timedOut: boolean;
};

let activeRead: ActiveRead | null = null;

export async function readRequest({ timeoutMs = 30_000 }: { timeoutMs?: number } = {}) {
  if (activeRead) {
    throw new TransportError("transport_unknown");
  }

  const read = { cancelled: false, timedOut: false };
  activeRead = read;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const support = await getNfcSupport();
    if (!support.supported) {
      throw new TransportError("nfc_unsupported");
    }
    if (!support.enabled) {
      throw new TransportError("nfc_disabled");
    }
    if (read.cancelled) {
      throw new TransportError("read_cancelled");
    }

    await NfcManager.start();
    if (read.cancelled) {
      throw new TransportError("read_cancelled");
    }

    timeout = setTimeout(() => {
      read.timedOut = true;
      void NfcManager.cancelTechnologyRequest({ throwOnError: false, delayMsAndroid: 0 });
    }, timeoutMs);

    await NfcManager.requestTechnology(NfcTech.Ndef, {
      isReaderModeEnabled: true,
      readerModeFlags: NfcAdapter.FLAG_READER_NFC_A,
    });
    const tag = await NfcManager.getTag();
    const record = tag?.ndefMessage[0];
    if (!record || !Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)) {
      throw new TransportError("transport_unknown");
    }

    return Ndef.uri.decodePayload(Uint8Array.from(record.payload));
  } catch (error) {
    if (read.timedOut) {
      throw new TransportError("read_timeout", undefined, { cause: error });
    }
    if (read.cancelled) {
      throw new TransportError("read_cancelled", undefined, { cause: error });
    }
    if (error instanceof TransportError) {
      throw error;
    }
    throw new TransportError("transport_unknown", undefined, { cause: error });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    if (activeRead === read) {
      activeRead = null;
    }
    await NfcManager.cancelTechnologyRequest({ throwOnError: false, delayMsAndroid: 0 });
  }
}

export async function cancelRead(): Promise<void> {
  if (!activeRead) {
    return;
  }

  activeRead.cancelled = true;
  await NfcManager.cancelTechnologyRequest({ throwOnError: false, delayMsAndroid: 0 });
}
