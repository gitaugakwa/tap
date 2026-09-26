# @tap/react-native

React Native NFC transport and payment hooks for Tap.

`@tap/react-native` connects `@tap/core` to Android Host Card Emulation for merchants and NFC reader mode for customers. The same hooks also support a QR fallback.

## What It Provides

- NFC capability detection with `getNfcSupport`.
- Read-only NDEF URL broadcasting through `startCharge`.
- Reader-mode payment request capture through `readRequest`.
- `useCharge` for merchant request creation, broadcast, expiry, and settlement state.
- `useTapToPay` for reading, verification, confirmation, and payment state.
- Pure reducers for deterministic state-machine testing.

## Merchant

```tsx
import { useCharge } from "@tap/react-native";

const charge = useCharge({
  account,
  merchantName: "your-shop.tap.eth",
  transport: "nfc",
});

await charge.start(5_000_000n);
```

Use `charge.url` with a QR renderer when `transport` is `"qr"`.

## Customer

```tsx
import { useTapToPay } from "@tap/react-native";

const payment = useTapToPay({ account });

await payment.startReading();

if (payment.state === "verified" && payment.verify?.ok) {
  await payment.confirm();
}
```

The Pay action must only be available in the verified state. Data read from NFC or QR remains untrusted until `@tap/core` completes signature and live ENS verification.

## Native Setup

The demo uses an Expo development build rather than Expo Go because HCE and NFC reader mode require native modules. Android configuration must include the NFC permission, HCE service, and NFC Forum Type 4 Tag AID.

See the [React Native SDK specification](../../docs/06-sdk-react-native.md), [NFC setup guide](../../docs/08-nfc.md), [public exports](src/index.ts), and [tests](test/) for details.

## Development

From the [Tap monorepo](https://github.com/gitaugakwa/tap) root:

```bash
bun install --frozen-lockfile
bun test packages/react-native
bun run --filter "@tap/react-native" typecheck
bun run --filter "@tap/react-native" build
```
