import { HCESession } from "react-native-hce";

let resetPromise: Promise<HCESession> | null = null;

export function resetHceSession() {
  resetPromise ??= HCESession.getInstance()
    .then(async (session) => {
      await session.setEnabled(false);
      return session;
    })
    .catch((error: unknown) => {
      resetPromise = null;
      throw error;
    });

  return resetPromise;
}
