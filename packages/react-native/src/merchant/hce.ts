import { HCESession, NFCTagType4, NFCTagType4NDEFContentType } from "react-native-hce";
import { TransportError } from "../errors";
import { getNfcSupport } from "../support";

let session: HCESession | null = null;
let operation = Promise.resolve();

function enqueue(task: () => Promise<void>) {
  const next = operation.then(task, task);
  operation = next.catch(() => undefined);
  return next;
}

export function startCharge(url: string): Promise<void> {
  return enqueue(async () => {
    const support = await getNfcSupport();
    if (!support.supported) {
      throw new TransportError("nfc_unsupported");
    }
    if (!support.enabled) {
      throw new TransportError("nfc_disabled");
    }
    if (!support.canEmulate) {
      throw new TransportError("hce_unsupported");
    }

    const nextSession = await HCESession.getInstance();
    session = nextSession;
    try {
      await nextSession.setApplication(
        new NFCTagType4({
          type: NFCTagType4NDEFContentType.URL,
          content: url,
          writable: false,
        }),
      );
      await nextSession.setEnabled(true);
    } catch (error) {
      session = null;
      await nextSession.setEnabled(false).catch(() => undefined);
      throw error;
    }
  });
}

export function stopCharge(): Promise<void> {
  return enqueue(async () => {
    const activeSession = session;
    session = null;
    await activeSession?.setEnabled(false);
  });
}
