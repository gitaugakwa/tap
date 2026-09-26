# @tap/core

Pure TypeScript primitives for signed tap-to-pay requests, ENS merchant verification, and USDC settlement through TapPay.

`@tap/core` contains no React Native or Expo imports. It can run in mobile apps, backend services, scripts, and web applications.

## What It Provides

- Create and sign short-lived EIP-712 payment requests.
- Encode and decode compact `https://tap-pay.xyz/p` request URLs.
- Resolve merchant identity live through ENSv2 and fail closed on mismatches.
- Pay with EIP-2612 permit or an approve fallback.
- Watch TapPay settlement events and read wallet balances.
- Format token amounts without floating-point math.

## Example

```ts
import {
  configureTap,
  encodeRequestUrl,
  newChargeRequest,
  signRequest,
} from "@tap/core";

configureTap({
  rpcUrls: {
    payment: process.env.BASE_SEPOLIA_RPC,
    ens: process.env.SEPOLIA_RPC,
  },
});

const request = newChargeRequest({
  merchant: account.address,
  merchantName: "your-shop.tap.eth",
  amount: 5_000_000n,
});

const signed = await signRequest(request, account);
const url = encodeRequestUrl(signed);
```

All amounts use `bigint`; token addresses, decimals, and deployed contracts come from the package's chain allowlist rather than payment links.

## Verification

Customer applications should pass decoded requests to `verifyRequest`. A successful result means the signature, expiry, network, token, direct `tap.eth` subname, and live ENS owner all agree.

```ts
import { decodeRequestUrl, verifyRequest } from "@tap/core";

const result = await verifyRequest(decodeRequestUrl(url));

if (!result.ok) {
  // Do not display or pay unverified request data.
  throw new Error(result.reason);
}
```

## Development

This package currently ships as a workspace package in the [Tap monorepo](https://github.com/gitaugakwa/tap). From the repository root:

```bash
bun install --frozen-lockfile
bun test packages/core
bun run --filter "@tap/core" typecheck
bun run --filter "@tap/core" build
```

See the [core SDK specification](../../docs/05-sdk-core.md), [public exports](src/index.ts), and [tests](test/) for the complete API and behavior.
