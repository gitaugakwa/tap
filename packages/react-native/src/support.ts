export type NfcSupport = {
  supported: boolean;
  enabled: boolean;
  canEmulate: boolean;
};

export function getNfcSupport(): Promise<NfcSupport> {
  throw new Error("not implemented: getNfcSupport");
}
