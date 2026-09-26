# 04 · ENS (ENSv2 on Sepolia)

ENS is the anchor bounty (**Best Use of ENSv2**). Its requirements: built on ENSv2 on Sepolia, ENSv2 features **central not cosmetic**, a functional demo with **no hard-coded values**, a live demo link, and an open-source repo. Everything below is designed so that removing ENS breaks the product.

## What we use from ENSv2, and why it's central
| ENSv2 feature | How Tap uses it | What breaks without it |
|---|---|---|
| **Hierarchical registry** (per-name UserRegistry) | `tap.eth` gets its own UserRegistry. Every merchant is a subname in *our* registry | No trusted merchant namespace; any `.eth` could impersonate |
| **Custom registrar** on our registry | `TapMerchantRegistrar` is the only issuer of `*.tap.eth` and binds each name to its owner's address at registration | Anyone could point a merchant name anywhere |
| **Enhanced Access Control** roles | The registrar holds exactly `ROLE_REGISTRAR` on the registry and `ROLE_SET_ADDRESS` + `ROLE_SET_TEXT` on the resolver; merchants get `ROLE_SET_RESOLVER` on their own name | No least-privilege issuance |
| **Permissioned Resolver** | Our per-account resolver stores each merchant's `addr` and `name` text record | No verified display name |
| **Universal Resolver** (live resolution) | Every tap resolves `name → address` and `name → display name` live | Verification would be a hard-coded map (disqualifying) |

Stretch (What's next): `tap.signer` record for key rotation via EAC delegation, and merchants graduating to their own resolver (they already hold `ROLE_SET_RESOLVER`).

## Namespace design
```
eth  (ETHRegistry, ENS-owned)
└─ tap.eth                        owner: ENS_OWNER (us)   resolver: our PermissionedResolver
   └─ subregistry: our UserRegistry (VerifiableFactory proxy)
      ├─ yoyogi-market.tap.eth    owner: merchant address   resolver: our PermissionedResolver
      │     addr(60) = merchant address,  text "name" = "Takoyaki Stand"
      └─ …                        issued only via TapMerchantRegistrar
```

**Rules** 🔒
1. Parent is `tap.eth` (backup `tappay.eth` if `tap.eth` is taken; the parent lives in one constant, `ENS_PARENT`, in `packages/core/src/config/chains.ts`).
2. Merchant names are **direct** children only: `<label>.tap.eth`. Labels are `[a-z0-9-]{3,32}` (enforced onchain by the registrar and offchain by `isUnderParent`).
3. **Never write records to the root name (`0x00`) on our resolver.** It becomes the default record for every unlinked name, which could make unregistered subnames resolve (threat T11).
4. Never hard-code a Universal Resolver or resolver address in the SDK. viem resolves through the canonical proxy on its own.
5. Display names come from the text record `name`. The SDK never shows a display name from the tag.

## Sepolia ENSv2 beta addresses
Source: https://docs.ens.domains/learn/deployments#sepolia-ensv2-beta (fetched 2026-09-26). **ENSv2 contracts are not final. Re-check this table at the start of the ENS work and at the ENS booth.** These are used by `scripts/setup-ens.ts` only, never by the SDK or app.

| Contract | Address |
|---|---|
| ETHRegistry (PermissionedRegistry for `.eth`) | `0x657ea849311d3d5823348dded7c2aaafb3ede09e` |
| ETHRegistrar | `0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca` |
| RootRegistry | `0x9703dbd26dab89504490994138cf2c575251a9ce` |
| VerifiableFactory | `0x9e726eb570beb6bceb495ab8cda7df517d4e841c` |
| UserRegistryImpl | `0xa80338aaa8d23831cea25e858d1774534abb0263` |
| PermissionedResolverImpl | `0x14f09fd05d4585759e54844dc9b00147131cf243` |
| Universal Resolver proxy (same on mainnet + Sepolia; don't hard-code in the SDK) | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` |
| MockUSDC (registration fee token; `mint` is open) | `0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e` |

ABIs: `contracts/lib/contracts-v2/contracts/deployments/sepolia/<Name>.json` after `forge install ensdomains/contracts-v2`. Scripts load ABIs from there rather than retyping signatures.

Role values (from ENS docs):
| Where | Role | Value |
|---|---|---|
| Registry | `ROLE_REGISTRAR` | `1n << 0n` |
| Registry | `ROLE_RENEW` | `1n << 16n` |
| Resolver | `ROLE_SET_ADDRESS` | `1n << 0n` |
| Resolver | `ROLE_SET_TEXT` | `1n << 4n` |
| Any | admin variant | `role << 128n` |
| Any | all roles + admins (initialisers) | `0x1111…1111n` (64 hex `1`s) |

## Setup runbook (SDK track, do early: H0.75–H2)
### Step 0: manual, ~10 min
1. Fund `ENS_OWNER` with Sepolia ETH (any public faucet).
2. Open the ENS app for Sepolia (https://app.ens.dev), connect the `ENS_OWNER` wallet, and check `tap.eth`.
   - Available → register it. The fee is in MockUSDC: mint some to yourself first (`mint(address,uint256)` on MockUSDC is open), then approve when the app asks.
   - Taken → use `tappay.eth`, and record the switch in `decisions.md` + `ENS_PARENT`.
3. Paste the tx link into the README's deployment section.

If the app can't register, fall back to the ETHRegistrar commit–reveal flow in a script (see https://docs.ens.domains/ensv2/eth-registrar) and ask at the ENS booth.

### Step 1: `bun run ens:setup` (`scripts/setup-ens.ts`, idempotent)
Each step checks current onchain state first and skips if already done, so the script is safe to re-run.

1. **Assert parent ownership:** `ETHRegistry.getState(labelhash("tap"))` is REGISTERED and `latestOwner == ENS_OWNER`. Otherwise stop with instructions for Step 0.
2. **Resolver:** predict the `ENS_OWNER` PermissionedResolver address (VerifiableFactory, salt `keccak256(abi.encode(keccak256("OwnedResolver"), owner, 0))`). If there's no code there, `deployProxy(PermissionedResolverImpl, salt, initialize([{ENS_OWNER, ALL_ROLES}], []))`. If `tap.eth`'s resolver differs, call `setResolver` on ETHRegistry for `labelhash("tap")`.
3. **UserRegistry:** predict with salt `keccak256(abi.encode(keccak256("UserRegistry"), namehash("tap.eth"), 0))`. If there's no code, `deployProxy(UserRegistryImpl, salt, initialize([{ENS_OWNER, ALL_ROLES}]))`. If `tap.eth`'s subregistry differs, call `ETHRegistry.setSubregistry(labelhash("tap"), userRegistry)`.
4. **Registrar:** if `chains.ts` → `ens.merchantRegistrar` has code, reuse it. Otherwise deploy `TapMerchantRegistrar(userRegistry, resolver, dnsEncode("tap.eth"))` from `contracts/out/TapMerchantRegistrar.sol/TapMerchantRegistrar.json`, print the address, and stop, asking for it to be pasted into `chains.ts` and the script re-run.
5. **Roles:** `userRegistry.grantRootRoles(ROLE_REGISTRAR, registrar)`; `resolver.grantRootRoles(ROLE_SET_ADDRESS | ROLE_SET_TEXT, registrar)`.
6. **Self-check:** `registrar.isAvailable("tap-setup-probe")` returns without reverting; print a summary table of every address and role.

Proxy address prediction (from the ENS docs, used in steps 2–3):
```ts
const outerSalt = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [deployer, salt]));
const initCode = concat(["0x3d604d80600a3d3981f3363d3d373d3d3d363d73", proxyLogic,
                         "0x5af43d82803e903d91602b57fd5bf3", outerSalt]);
getCreate2Address({ from: VERIFIABLE_FACTORY, salt: outerSalt, bytecodeHash: keccak256(initCode) });
// proxyLogic = await factory.read.proxyLogic()
```

> ⚠️ Confirm exact function names and signatures (`setResolver`, `setSubregistry`, `getSubregistry`, `getState`, `grantRootRoles`, `initialize`) against the ABI JSONs before running. The docs note that ENSv2 interfaces may still change.

### Step 2: `bun run ens:register -- --label yoyogi-market --owner 0x… --display "Takoyaki Stand"`
`scripts/register-merchant.ts`:
1. `registrar.isAvailable(label)`, else stop.
2. `registrar.register(label, owner, display)` from `ENS_OWNER_PK` (anyone can call; `ENS_OWNER` just has the gas).
3. Wait for the receipt, then verify through the **public resolution path**: `getEnsAddress({ name: "<label>.tap.eth" }) == owner` and `getEnsText({ key: "name" }) == display`. Print ✓/✗.

The demo merchant's `owner` is the address shown in the merchant phone's Settings screen (its key lives on the phone). For e2e, register a second merchant (`e2e-merchant`) owned by `MERCHANT_PK`.

## Resolution in the SDK
```ts
import { normalize } from "viem/ens";
const name = normalize(merchantName);                        // always normalize first
const [addr, displayName] = await Promise.all([
  ensClient.getEnsAddress({ name }),                         // null or 0x0 → unresolved
  ensClient.getEnsText({ name, key: "name" }),
]);
```
- `ensClient` is a viem public client on `sepolia`. No resolver address config: viem uses the Universal Resolver proxy.
- **viem must be an ENSv2-ready version.** Check the minimum at https://docs.ens.domains/web/ensv2-readiness and pin at least that. Smoke test: resolve the docs' test name (e.g. `ur.integration-tests.eth`).
- Treat `null` **and** the zero address as `ens_unresolved`.
- Don't cache resolution results across taps. It's cheap, and a merchant's record could change.
- CCIP-Read needs plain HTTP `fetch`. It works in React Native, but if resolution works in scripts and fails in the app, check network/fetch first.

## Bounty write-up (README section, drafted during H9–11)
- One paragraph: why merchant identity is the problem and ENS is the fix.
- A table like the one at the top of this file, with **links to exact lines**: `packages/core/src/verify/verify-request.ts`, `packages/core/src/verify/ens.ts`, `contracts/src/TapMerchantRegistrar.sol`, `scripts/setup-ens.ts`.
- Deployed addresses: `tap.eth` UserRegistry, resolver, registrar, and the demo merchant's registration tx.
- Trade-offs, stated honestly: managed namespace, registrar roles are resolver-wide, free registration (squatting possible).

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Subname registers but doesn't resolve | `tap.eth` not pointed at our UserRegistry (`setSubregistry`), or no `addr` record set |
| `EACUnauthorizedAccountRoles` on `register` | Registrar missing `ROLE_REGISTRAR` on the UserRegistry |
| `EACUnauthorizedAccountRoles` on `setAddress`/`setText` | Registrar missing resolver roles |
| `EACCannotGrantRoles` | The account granting lacks the `_ADMIN` variant; check the `initialize` grants |
| Resolves in scripts, `null` in app | viem too old in the app bundle, or fetch/CCIP-Read blocked |
| Unregistered `x.tap.eth` resolves | Someone wrote records to the root name on our resolver. Unlink/clear it (rule 3) |
