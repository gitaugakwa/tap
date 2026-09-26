# Tap

Tap turns two ordinary Android phones into a crypto point of sale: the merchant enters an
amount, the customer taps, the wallet verifies the merchant through ENSv2, and USDC settles on
Base Sepolia.

[![check](https://github.com/gitaugakwa/tap/actions/workflows/check.yml/badge.svg)](https://github.com/gitaugakwa/tap/actions/workflows/check.yml)

Built for ETHGlobal Tokyo 2026.

## The problem

- Small merchants should not need dedicated payment hardware.
- A QR code containing a wallet address can be replaced without the customer noticing.
- Raw addresses do not tell a customer who will receive their money.

Tap signs every payment request, transports it over NFC or QR, and resolves the merchant's
name live under the managed `tap.eth` namespace before enabling payment. Removing ENS removes
the product's identity and anti-substitution guarantee.

## How it works

```text
Merchant phone                     Customer phone                     Chains
     |                                    |                              |
     | Sign EIP-712 payment request       |                              |
     | Serve URL over NFC or QR ---------->                              |
     |                                    | Verify signature             |
     |                                    | Resolve *.tap.eth ----------> Sepolia ENSv2
     |                                    | Check name -> signer          |
     |                                    | Confirm + USDC permit -------> Base Sepolia
     | <------------------------ Paid event for merchant + nonce -------- TapPay
     | Both phones show paid             |                              |
```

Each request binds the merchant, token, amount, nonce, expiry, merchant ENS name, chain, and
TapPay contract into one EIP-712 signature. `TapPay` rejects expired, altered, and replayed
requests and emits a `Paid` event tied to the exact merchant nonce.

## Why ENSv2 is central

| ENSv2 feature | Tap usage | What breaks without it |
|---|---|---|
| Hierarchical registry | `tap.eth` owns a dedicated UserRegistry containing merchant subnames | There is no trusted merchant namespace |
| Custom registrar | `TapMerchantRegistrar` binds each direct subname to its owner when issuing it | Merchant names are not reliably bound to payout keys |
| Enhanced Access Control | The registrar receives only the registry and resolver roles needed for issuance | Registration requires an over-privileged operator |
| Permissioned Resolver | Stores the merchant address and human-readable display name | The wallet cannot obtain trusted merchant metadata |
| Universal Resolver | Every tap resolves the merchant live through the public ENS path | Verification becomes a closed, hard-coded allowlist |

Relevant implementation:

- [`TapMerchantRegistrar.register`](contracts/src/TapMerchantRegistrar.sol#L68-L105)
- [ENS merchant resolution](packages/core/src/verify/ens.ts#L27-L70)
- [Ordered request verification](packages/core/src/verify/verify-request.ts#L108-L167)
- [Idempotent ENS setup and EAC grants](scripts/setup-ens.ts#L236-L278)
- [Live ENS check](scripts/check-ens.ts#L12-L47)
- [Funded end-to-end payment](scripts/e2e.ts#L61-L134)

## Architecture

| Layer | Package | Responsibility |
|---|---|---|
| Demo application | `apps/mobile` | Wallet UX, merchant/customer screens, QR fallback, settings |
| Native SDK | `@tap/react-native` | NFC HCE, reader mode, charge/payment state machines |
| Core SDK | `@tap/core` | Requests, signatures, ENS verification, payment, configuration |
| Contracts | `contracts` | Replay-safe settlement and permissionless merchant registration |

Dependencies only point downward:

```text
apps/mobile -> @tap/react-native -> @tap/core
                                  -> TapPay / ENSv2
```

The mobile app contains no ABIs, deployed addresses, or direct `viem` dependency. All deployed
configuration lives in [`packages/core/src/config/chains.ts`](packages/core/src/config/chains.ts).

## Deployed contracts

| Component | Network | Address |
|---|---|---|
| TapPay | Base Sepolia | [`0x4c679b2dE8AE517fF12AA34A1bE0F81913678792`](https://sepolia.basescan.org/address/0x4c679b2dE8AE517fF12AA34A1bE0F81913678792) |
| TapSwapPay | Base Sepolia | [`0xA36df4D6DA08bA1FbE89ddEB7229218FAf0BF84d`](https://sepolia.basescan.org/address/0xA36df4D6DA08bA1FbE89ddEB7229218FAf0BF84d) |
| `tap.eth` UserRegistry | Sepolia | [`0x6A2Cad68E45E1A5D5DF62D8deF294455c2360D78`](https://sepolia.etherscan.io/address/0x6A2Cad68E45E1A5D5DF62D8deF294455c2360D78) |
| Permissioned Resolver | Sepolia | [`0x7F7c02793854B68B8fa5776EB768cbac5966AdCA`](https://sepolia.etherscan.io/address/0x7F7c02793854B68B8fa5776EB768cbac5966AdCA) |
| TapMerchantRegistrar | Sepolia | [`0xcF7F9f2f0a9a471B1E2D6c4F0D1a59563821B759`](https://sepolia.etherscan.io/address/0xcF7F9f2f0a9a471B1E2D6c4F0D1a59563821B759) |

TapPay deployment transaction:
[`0x5139...69d2`](https://sepolia.basescan.org/tx/0x5139eadb16cae193bca62c9d9f0098927b826742bfbc7014a84b3e79c93769d2).
TapSwapPay deployment transaction:
[`0x34b2...58d3`](https://sepolia.basescan.org/tx/0x34b2e25bf8728c74d02971d1b76cded41e37b7bcad95814afb4e89fd01ae58d3).
Latest protected P3 payment:
[`0xbe61...c53a`](https://sepolia.basescan.org/tx/0xbe61a3aaea39b053e458d5aae479dd7eac3a184efe13c1b2a3520c743a94c53a).

`e2e-merchant.tap.eth` resolves publicly to the configured test merchant and carries the text
record `name = E2E Test Merchant`. The phone-owned `yoyogi-market.tap.eth` name is registered
during final device integration so its address matches the key generated on that merchant phone.

## Run the checks

Requirements: Bun 1.4.2 and Foundry.

```bash
bun install --frozen-lockfile
bun run check
```

The gate runs architecture enforcement, formatting/linting, TypeScript checks, SDK tests,
Foundry tests, and generated-ABI drift detection.

For the live SDK path, create `.env` from [`.env.example`](.env.example), configure both RPC URLs
and the four test keys, then fund the customer with Base Sepolia ETH and USDC.

```bash
bun run e2e
```

This submits a real `$0.01` USDC payment. It checks live ENS resolution, signature and URL
roundtrip, tamper rejection, SDK/contract hash parity, settlement, `isPaid`, and replay rejection.
After registering the merchant phone during J1, `bun run ens:check` verifies both demo names and
their display records through the public ENS path.

## Run the Android demo

The app requires an Expo development build because NFC HCE is native functionality.

```bash
cd apps/mobile
cp .env.example .env
bunx expo prebuild --clean --platform android
bunx expo run:android
bunx expo start --dev-client
```

The merchant phone serves a signed URL using Android HCE. The customer phone reads it using
reader mode. QR transport exercises the same signed payload and verification path when NFC is
unavailable.

## Security model

| Threat | Defense |
|---|---|
| Swapped NFC tag or QR code | Every request field is signed; the customer resolves the signed ENS name live |
| Foreign or nested ENS name | Only valid direct children of `tap.eth` are accepted |
| Merchant-name substitution | The ENS address must equal the request signer and payout address |
| Replay | `TapPay` stores used nonces per merchant |
| Stale request | SDK and contract both enforce the two-minute expiry |
| Wrong network, token, or contract | Explicit allowlists and EIP-712 domain binding |
| RPC failure | Verification fails closed; network failure is never treated as verified |
| Permit front-running | Settlement tolerates a consumed permit only when sufficient allowance already exists |

See [the full threat model](docs/02-architecture.md) and
[enforced invariants](docs/09-quality-and-commits.md).

## Trade-offs

- `tap.eth` is a managed namespace. The registrar is permissionless and first-come for the
  hackathon; production needs anti-squatting controls.
- Resolver write roles are record-type scoped but not merchant-name scoped. The registrar has no
  write path except the name it is registering.
- Merchant keys currently live in secure storage on the phone. A production version should use
  an ENS signer record or smart account so payout ownership and signing authority can rotate
  independently.
- Android merchants can emulate NFC cards. iPhone merchant support requires a different transport;
  iPhone customer reading is a natural next step.

## What's next

- Spending limits or session keys for low-value payments without a confirmation tap
- Rotatable `tap.signer` records using ENSv2 EAC delegation
- Merchant onboarding and anti-squatting controls
- iPhone customer support
- Production networks and independently managed merchant resolvers

Detailed design and build decisions live in [`docs/`](docs/README.md).
