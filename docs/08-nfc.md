# 08 · NFC (HCE + reader)

## How it works
The merchant phone **pretends to be an NFC tag** (Host Card Emulation) holding one NDEF URI record: the signed request URL. The customer phone **reads it like any tag**. iPhones can read tags but can't emulate without an Apple entitlement, which is why the merchant is Android (D02).

We emulate an **NFC Forum Type 4 Tag**. Under the hood the reader sends ISO-DEP APDUs:
```
reader → SELECT AID D2760000850101          (NDEF Tag Application)
reader → SELECT FILE E103                   (Capability Container)
reader → READ BINARY                        (CC: max sizes, NDEF file id)
reader → SELECT FILE E104                   (NDEF file)
reader → READ BINARY (length, then data)    → our URI record
```
`react-native-hce` implements this APDU dance. We only hand it the URL.

## Merchant: `react-native-hce`
```ts
// packages/react-native/src/merchant/hce.ts (sketch; verify against the library README)
import { HCESession, NFCTagType4, NFCTagType4NDEFContentType } from "react-native-hce";

let session: HCESession | null = null;

export async function startCharge(url: string) {
  const tag = new NFCTagType4({ type: NFCTagType4NDEFContentType.URL, content: url, writable: false });
  session = await HCESession.getInstance();
  session.setApplication(tag);
  await session.setEnabled(true);
}

export async function stopCharge() {
  if (session) await session.setEnabled(false);
}
```

### Android manifest via `apps/mobile/plugins/withHce.js`
First check whether `react-native-hce` ships its own Expo config plugin. If it does, use that and delete `withHce.js` (record in `decisions.md`). Otherwise our plugin must produce:

`AndroidManifest.xml` additions:
```xml
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc.hce" android:required="false" />
<application>
  <service
      android:name="com.reactnativehce.services.CardService"
      android:exported="true"
      android:enabled="false"
      android:permission="android.permission.BIND_NFC_SERVICE">
    <intent-filter>
      <action android:name="android.nfc.cardemulation.action.HOST_APDU_SERVICE" />
      <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
    <meta-data
        android:name="android.nfc.cardemulation.host_apdu_service"
        android:resource="@xml/aid_list" />
  </service>
</application>
```
`android/app/src/main/res/xml/aid_list.xml`:
```xml
<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/app_name"
    android:requireDeviceUnlock="false">
  <aid-group android:category="other" android:description="@string/app_name">
    <aid-filter android:name="D2760000850101" />
  </aid-group>
</host-apdu-service>
```
Plugin structure: `withAndroidManifest` (permission, feature, service) + `withDangerousMod` (write `aid_list.xml`). Check the exact service class name, and whether it should start `enabled="false"`, against the current `react-native-hce` README. `hce` is `required="false"` so the app still installs on phones without HCE (they get the QR path).

## Customer: `react-native-nfc-manager`
```ts
// packages/react-native/src/customer/reader.ts (sketch)
import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";

export async function readRequest({ timeoutMs = 30_000 } = {}): Promise<string> {
  await NfcManager.start();
  const timer = setTimeout(() => NfcManager.cancelTechnologyRequest(), timeoutMs);
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);        // Android: reader mode
    const tag = await NfcManager.getTag();
    const record = tag?.ndefMessage?.[0];
    if (!record) throw new TransportError("transport_unknown");
    return Ndef.uri.decodePayload(Uint8Array.from(record.payload));
  } finally {
    clearTimeout(timer);
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
```
Reader mode matters: it stops the customer phone's own wallet/HCE from answering while it reads.

## Spike (Flow track, first ~1.5h, highest-risk item)
**Goal:** phone A (HCE) serves a hardcoded `https://tap.xyz/p?v=1&test=1` and phone B reads and displays it.

1. `bunx create-expo-app` inside `apps/mobile` (or the scaffold), add `react-native-hce`, `react-native-nfc-manager`, `withHce.js`.
2. `bunx expo prebuild --clean && bunx expo run:android` on both phones (or an EAS dev build APK).
3. Phone A: a button toggles HCE with the hardcoded URL. Phone B: a button calls `readRequest()`.
4. **Pass criteria:** 10 out of 10 reads, each < 2s after contact, both phones unlocked with the screen on. Note the phone models and Android versions in `decisions.md`.
5. Also try: phone B with Google Wallet set as default payment app; phone A locked (expect failure; that's fine, we keep the screen awake).

**If the spike isn't passing after ~60 min**, switch to the QR transport for the demo (`transport: "qr"`) and keep debugging NFC in parallel. Everything after the transport is identical, so no other work is blocked.

## Troubleshooting
| Symptom | Try |
|---|---|
| Reader sees nothing | Both phones unlocked, screens on; NFC on in Settings; move the phones slowly back-to-back (antenna is often mid-back) |
| Reader opens Google Wallet / another app | Make sure the reader uses `requestTechnology` (reader mode) and the app is in the foreground |
| HCE phone never answers | `withHce` didn't apply: check the generated `android/app/src/main/AndroidManifest.xml` and `res/xml/aid_list.xml` after `prebuild` |
| Works once, then not again | `cancelTechnologyRequest()` missing in a `finally`; `stopCharge()` not called before the next `startCharge()` |
| URL truncated | URL too long; check < 400 bytes (unit test in core) |
| Only fails at the venue | RF noise / cases: remove phone cases, and fall back to QR for the demo if needed |

## QR fallback
- Merchant: `useCharge({ transport: "qr" })` exposes `url` → `QrCode` renders it.
- Customer: `QrScanner` (expo-camera) → `useTapToPay().submitUrl(url)`.
- Keep this path working at all times (protected flow P6 in `09-quality-and-commits.md`).
