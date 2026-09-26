# Uniswap Hackathon Feedback

## Project

- **Name:** Tap
- **Hackathon:** ETHGlobal Tokyo 2026
- **Repository:** https://github.com/gitaugakwa/tap
- **Integration:** Uniswap v3 exact-output swaps on Base Sepolia

Tap is a two-phone point of sale. A merchant signs an exact USDC request; the customer verifies
the merchant through ENSv2, then pays directly in USDC or selects ETH. The Uniswap path preserves
the same signed amount, nonce, expiry, merchant identity, and settlement event.

## What We Built

- `TapSwapPay` calls SwapRouter02 `exactOutput`, settles the resulting USDC through the existing
  `TapPay`, and refunds unused input atomically.
- Native ETH is one transaction. Standard ERC-20 input is supported through Permit2 after a
  one-time token approval.
- The SDK asks QuoterV2 for direct pools and common WETH-bridged routes, selects the least input,
  and applies a visible integer-only slippage ceiling.
- Direct USDC remains the default and does not touch Uniswap.

## Evidence

- Adapter: [`0xA36d...F84d`](https://sepolia.basescan.org/address/0xA36df4D6DA08bA1FbE89ddEB7229218FAf0BF84d)
- Deployment: [`0x34b2...58d3`](https://sepolia.basescan.org/tx/0x34b2e25bf8728c74d02971d1b76cded41e37b7bcad95814afb4e89fd01ae58d3)
- Funded exact-output payment: [`0x1cfd...abfa`](https://sepolia.basescan.org/tx/0x1cfd4e9ea0fb449711c771cda22da566bc7d32180c95d9423ec1a61351caabfa)
- Reproduce: `bun run e2e:swap`

The funded test checks exact merchant USDC balance change, customer attribution, input below the
displayed maximum, compatibility with the original `Paid` watcher, and replay rejection.

## Developer Feedback

**What worked well**

- QuoterV2 and SwapRouter02 made exact-output settlement straightforward and kept price risk with
  an explicit payer-side maximum.
- Permit2 maps well to short-lived payment requests because spender, amount, nonce, and expiry can
  be scoped to one adapter call.
- Stable canonical deployments reduced configuration risk across SDK, app, and contract tests.

**What could improve**

- Testnet liquidity discovery is the hardest part of a mobile integration. A documented endpoint
  or canonical registry for supported testnet pools and liquidity would save substantial probing.
- Router documentation could show a complete native exact-output example, including reversed v3
  path encoding, `msg.value`, `refundETH`, and refund accounting in one place.
- The hosted Trading API requires a server-side API key, while this project is intentionally a
  client SDK with no backend. Guidance for secure mobile-only integrations would be useful.
- Permit2 examples commonly stop before the full lifecycle. A reference covering token approval,
  allowance nonce reads, typed-data signing, front-run tolerance, and atomic consumption would help.

## Form Status

- [ ] Submit this feedback at https://developers.uniswap.org/hackathon-feedback using the team's
  contact details before the ETHGlobal deadline.
