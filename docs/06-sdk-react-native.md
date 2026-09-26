# 06 · SDK: `@tap/react-native`

The transport layer. It moves request URLs over NFC and wraps `@tap/core` in two React hooks. **No crypto, no addresses, no viem calls of its own**: everything chain-related goes through `@tap/core`.

## Folder layout
```
packages/react-native/
├─ package.json            # name "@tap/react-native"
│                          # peerDependencies: react, react-native, @tap/core,
│                          #   react-native-hce, react-native-nfc-manager
├─ tsconfig.json
├─ tsup.config.ts
├─ src/
│  ├─ index.ts             # 🔒 public API (re-exports only)
│  ├─ support.ts           # getNfcSupport()
│  ├─ errors.ts            # TransportError codes
│  ├─ merchant/
│  │  ├─ hce.ts            # startCharge(), stopCharge()  ← react-native-hce
│  │  ├─ charge-machine.ts # PURE reducer for the charge state machine (no RN imports)
│  │  └─ useCharge.ts      # hook = machine + core + hce
│  └─ customer/
│     ├─ reader.ts         # readRequest(), cancelRead()  ← react-native-nfc-manager
│     ├─ pay-machine.ts    # PURE reducer for the tap-to-pay state machine (no RN imports)
│     └─ useTapToPay.ts    # hook = machine + core + reader
└─ test/
   ├─ charge-machine.test.ts
   └─ pay-machine.test.ts
```
The state machines are **pure reducers** so they can be unit-tested with `bun test` without loading native modules. Hooks are thin wiring around them.

## Public API 🔒
```ts
// support
getNfcSupport(): Promise<{ supported: boolean; enabled: boolean; canEmulate: boolean }>

// merchant (low level)
startCharge(url: string): Promise<void>     // serve url as a read-only NDEF URI record over HCE
stopCharge(): Promise<void>                 // idempotent

// customer (low level)
readRequest(opts?: { timeoutMs?: number }): Promise<string>   // default timeout 30_000; resolves with the URL
cancelRead(): Promise<void>                                   // idempotent

// hooks (both accept `core?: TapCoreLike`: defaults to the real @tap/core; pass
// createFakeCore() from "@tap/core/testing" to build UI before the chain code lands)
useCharge(opts: {
  account: LocalAccount;
  merchantName: string;
  transport?: "nfc" | "qr";                          // default "nfc"
  demoTamper?: "m" | "n" | "t" | "a" | "x" | "k" | "c" | null;  // demo-only: serve a tampered URL
  core?: TapCoreLike;
}): {
  state: ChargeState;
  amount?: bigint;
  url?: string;              // for the QR fallback, and debug display
  expiresAt?: Date;
  txHash?: Hash | null;
  error?: { code: string; message: string };
  start(amount: bigint): Promise<void>;
  cancel(): Promise<void>;
  reset(): void;
}

useTapToPay(opts: { account: LocalAccount; core?: TapCoreLike }): {
  state: PayState;
  verify?: VerifyResult;
  signed?: SignedRequest;
  txHash?: Hash;
  error?: { code: string; message: string };
  startReading(): Promise<void>;
  submitUrl(url: string): Promise<void>;   // QR fallback path: same pipeline after transport
  confirm(): Promise<void>;                // NO-OP unless state === "verified" (INV-17)
  reset(): void;
}
```

## Charge state machine (merchant)
```
idle ──start(amount)──► preparing ──signed + broadcasting──► waiting ──Paid──► paid
                           │                                   │  ├─expiry──► expired
                           └──error──► error                   │  └─cancel()─► cancelled
                                                               └─error──► error
any terminal state ──reset()──► idle
```
| State | Entry actions |
|---|---|
| `preparing` | `newChargeRequest` → `signRequest` → `encodeRequestUrl` (→ `tamperRequestUrl` only if `demoTamper`) |
| `waiting` | nfc: `startCharge(url)`; qr: expose `url`. Start `watchPaid(merchant, nonce)`. Start a timer to `expiresAt` |
| `paid` | `stopCharge()`, stop the timer, keep `txHash` |
| `expired` / `cancelled` / `error` | `stopCharge()`, unsubscribe `watchPaid`, stop the timer |

Rules: only one active charge at a time (`start` while `waiting` → error `charge_in_progress`). Every exit path runs cleanup (unit-tested).

## Tap-to-pay state machine (customer)
```
idle ──startReading()──► reading ──url──► verifying ──ok──► verified ──confirm()──► paying ──success──► paid
  │                        │                 │                 │                        └─revert/err─► failed
  └──submitUrl(url)────────┼─────────────────┘                 └─expiry passes──► rejected (expired)
                           └─timeout/cancel/error──► error      verifying ──not ok──► rejected
any terminal state ──reset()──► idle
```
| State | Meaning | UI shows |
|---|---|---|
| `reading` | waiting for a tap | "Hold near the merchant's phone" |
| `verifying` | decode + `verifyRequest` | spinner |
| `verified` | `verify.ok === true` | merchant card + **Pay** button |
| `rejected` | `verify.ok === false` (or decode failed → `malformed`) | "Unverified merchant" + reason, **no Pay button** |
| `paying` | `payWithPermit` sent, waiting for the receipt | pending |
| `paid` | receipt `success` | green ✓ |
| `failed` | `TapPayError` or reverted | error copy + retry/reset |
| `error` | NFC problem (unsupported, disabled, timeout) | error copy |

Rules: `confirm()` is ignored in every state except `verified`. While `verified`, a timer moves to `rejected` with reason `expired` at `expiresAt`. `decodeRequestUrl` throwing becomes `rejected` / `malformed`, never `error`.

## Transport error codes
`nfc_unsupported`, `nfc_disabled`, `hce_unsupported`, `read_timeout`, `read_cancelled`, `charge_in_progress`, `transport_unknown`. Payment errors pass through `TapPayError.code` from `@tap/core`.

## Platform notes
- Android only for the hackathon. `getNfcSupport()` returns `canEmulate: false` on iOS; the app hides the merchant role there.
- Native details (AID, manifest, reader mode) are in `08-nfc.md`.
- Always `cancelTechnologyRequest()` in a `finally` after reading; always `stopCharge()` on unmount (hooks clean up in `useEffect` return).

## Tests (`bun test`)
- `charge-machine.test.ts`: every transition in the diagram; cleanup is requested on every exit; double `start` rejected.
- `pay-machine.test.ts`: every transition; `confirm` ignored outside `verified`; expiry while verified → rejected; decode error → rejected/malformed.
