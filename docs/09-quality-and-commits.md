# 09 · Quality, commits and regressions

Three goals: **small commits**, **clear commit messages**, and **no regressions**. Flows that already work must keep working, and every change must say what it touched and what it deliberately didn't.

---

## 1. Invariants 🔒
Each invariant has an enforcing check. **Deleting, skipping (`.skip`, `.only`, `vm.skip`) or weakening an enforcing test is forbidden.** If one seems wrong, stop and raise it with your teammate.

| ID | Invariant | Enforced by |
|---|---|---|
| INV-01 | **The tag is untrusted input.** `verifyRequest` returns `ok: true` only if all of INV-02..06 hold | `verify/verify-request.test.ts` |
| INV-02 | The EIP-712 signature is from `merchant` (EOA or ERC-1271) | `verify-request.test.ts: bad_signature`; `TapPay.t.sol: test_RevertWhen_WrongSigner` |
| INV-03 | `merchantName` resolves **live on Sepolia ENSv2** to `merchant`. Never a hard-coded map | `verify-request.test.ts: ens_unresolved / ens_mismatch`; `check-architecture.ts` (no name→address maps) |
| INV-04 | `merchantName` is a **direct** subname of `ENS_PARENT` with a valid label | `verify/ens.test.ts` |
| INV-05 | Not expired (SDK: `now < expiry`; contract: `block.timestamp < expiry`) | `verify-request.test.ts: expired`; `TapPay.t.sol: test_RevertWhen_Expired` |
| INV-06 | chainId + token must be allowlisted; symbol/decimals/TapPay address come from the allowlist, **never the tag** | `verify-request.test.ts: unknown_chain / unknown_token` |
| INV-07 | Tampering with any field (m, n, t, a, x, k, c) fails verification | `verify-request.test.ts: tamper matrix`; `TapPay.t.sol: testFuzz_TamperAnyField` |
| INV-08 | Nonce is single-use per merchant | `TapPay.t.sol: test_RevertWhen_Replay` |
| INV-09 | Hash parity: TS `hashRequest` == `TapPay.hashRequest` | Both test suites read `contracts/test/fixtures/hash-vector.json`; e2e compares live |
| INV-10 | URL codec roundtrip is lossless; malformed input throws `TapDecodeError`; URL < 400 bytes | `request/url.test.ts` |
| INV-11 | Permit: value = amount, spender = TapPay, deadline = expiry; token domain read from the token | `payment/permit.test.ts` |
| INV-12 | Amounts are `bigint` end to end. No `Number`/float maths on amounts | `check-architecture.ts` (no `parseFloat(`/`.toFixed(` in `packages/core/src` or `apps/mobile`; no `Number(` in `packages/core/src/{payment,format.ts}`); `format.test.ts` |
| INV-13 | `@tap/core` has zero `react-native` / `expo` imports | `check-architecture.ts` |
| INV-14 | `apps/mobile` imports no `viem`, no ABIs, holds no addresses; chain logic only via `@tap/*` | `check-architecture.ts` |
| INV-15 | Address literals (`0x` + 40 hex) only in `packages/core/src/config/chains.ts`, tests, fixtures, `contracts/`, `scripts/` | `check-architecture.ts` |
| INV-16 | Private keys never logged, committed or sent anywhere; `.env` gitignored | `check-architecture.ts` (no `console.*` with `privateKey`/`PK`), `.gitignore` |
| INV-17 | The customer UI can only call `confirm()` when `state === "verified"` and `verify.ok` | `pay-machine.test.ts` + manual P5 |
| INV-18 | `abi.ts` matches the compiled contracts | `bun run abi:check` |
| INV-19 | Never write records to the root name on our ENS resolver | `setup-ens.ts` has no root-name writes (code review) + `ens.test.ts` zero-address case |
| INV-20 | **No AI attribution in commits or PRs** | `.githooks/commit-msg` + CI |

## 2. Protected flows
Once a flow works, it's **protected**: every later commit must leave it working. Before starting a task, write down which protected flows it could affect. The commit message's "What did NOT change" section is where you confirm they still pass.

| ID | Flow | Verified by | When to run |
|---|---|---|---|
| P1 | Contract settlement (permit + approve, all reverts) | `bun run test:contracts` | every commit (in `check`) |
| P2 | Request create → sign → encode → decode → verify (mocked ENS) | `bun run test` | every commit (in `check`) |
| P3 | **Live**: sign → verify (real ENS) → payWithPermit (Base Sepolia) → isPaid → replay rejected → tampered rejected | `bun run e2e` | any change to `contracts/`, `packages/core/src/{request,verify,payment,config}` |
| P4 | **Live ENS**: `yoyogi-market.tap.eth` and `e2e-merchant.tap.eth` resolve to their owners, with display names | `bun run ens:check` | any change to ENS code/scripts, and before demos |
| P5 | **Phones, NFC**: $5 → tap → verified card → Pay → both green | manual smoke (below) | any change to `packages/react-native` or `apps/mobile` |
| P6 | **Phones, QR fallback**: same as P5 via QR | manual smoke | same as P5 |
| P7 | **Phones, failure**: demo tamper on → "Unverified merchant", no Pay button | manual smoke | same as P5 |

A flow only becomes protected once it has passed for the first time. Tick it in `CLAUDE.md` → Status.

**Manual smoke (≈2 min, two phones):** P5 once, P7 once, P6 once. Record the result in the commit message (`manual smoke: P5 ✅ P6 ✅ P7 ✅`).

## 3. The regression gate
Root `package.json` scripts:
```json
{
  "scripts": {
    "arch": "bun run scripts/check-architecture.ts",
    "lint": "biome check .",
    "typecheck": "bun run --filter '*' typecheck",
    "test": "bun test packages",
    "test:contracts": "cd contracts && forge test",
    "abi": "bun run scripts/generate-abi.ts",
    "abi:check": "bun run abi && git diff --exit-code packages/core/src/config/abi.ts",
    "check": "bun run arch && bun run lint && bun run typecheck && bun run test && bun run test:contracts && bun run abi:check",
    "e2e": "bun run scripts/e2e.ts",
    "ens:setup": "bun run scripts/setup-ens.ts",
    "ens:register": "bun run scripts/register-merchant.ts",
    "ens:check": "bun run scripts/check-ens.ts",
    "hooks:install": "git config core.hooksPath .githooks"
  }
}
```
- `bun run check` must pass **before every commit** (pre-commit hook) and in CI.
- `bun run e2e` / `ens:check` hit live testnets (they need funds and RPC), so they're not in the hook. Run them when the table above says so, and always before merging to `main`.
- Never use `--no-verify`, `.skip`, `.only`, `@ts-ignore`, `@ts-expect-error`, `biome-ignore` or `any` to get green. Fix the cause, or stop and ask.

### `scripts/check-architecture.ts`
Simple file scans that fail with `file:line` and the rule ID:
- INV-12: `parseFloat(`, `.toFixed(` in `packages/core/src/**` and `apps/mobile/**`; `Number(` in `packages/core/src/payment/**` and `packages/core/src/format.ts`
- INV-13: `from "react-native`, `from "expo` in `packages/core/src/**`
- INV-14: `from "viem`, `abi` imports, `0x…{40}` in `apps/mobile/**`
- INV-15: `0x[0-9a-fA-F]{40}` outside the allowed paths
- INV-16: `console.` on a line mentioning `privateKey`, `PRIVATE_KEY` or `_PK`
- Layering: `packages/core` must not import `@tap/react-native`; `packages/react-native` must not import from `apps/`

## 4. Commit protocol

### Small commits
- **One logical change per commit.** If the summary needs "and", it's two commits.
- Aim for **≤ ~150 changed lines** excluding lockfiles, generated files (`abi.ts`) and fixtures. Bigger is allowed only when it can't be split (e.g. the initial scaffold). Say why in the message.
- **Never mix** in one commit: a refactor with a behaviour change · formatting with logic · a dependency change with a feature · contracts with app code · generated files with unrelated edits.
- **Every commit is green** (`bun run check`) and leaves every protected flow working. No "WIP" or "fix tests later" commits on shared branches.
- A new behaviour lands **with its tests in the same commit**. A bug fix lands with a test that failed before the fix.
- Push small and often: after each commit or two. Small PRs, merged quickly.

A typical feature, as commits:
```
feat(core): add PAYMENT_REQUEST_TYPES and hashRequest with parity vector
feat(core): add signRequest
feat(core): add encodeRequestUrl/decodeRequestUrl with roundtrip tests
feat(core): add verifyRequest offline checks (shape, allowlist, expiry, signature)
feat(core): add ENS checks to verifyRequest
```

### Before each commit: the change-impact check
1. `git diff --stat`: every file listed belongs to this task. Revert anything else (stray formatting, unrelated edits).
2. Public API touched? (`types.ts`, `index.ts` in either package, contract interfaces, wire format.) If yes, it must be an agreed 🔒 change with a `decisions.md` entry in the same commit.
3. Which protected flows could this affect? Run their checks (section 2).
4. `bun run check` passes.

### Commit message template
```
<type>(<scope>): <imperative summary, ≤ 72 chars>

Why:
- <the problem or goal this commit addresses>

What changed:
- <path or module>: <what changed and how>
- <path or module>: <…>

What did NOT change:
- <public API / wire format / contracts / protected flows deliberately left untouched>
- Protected flows re-checked: P1 ✅ P2 ✅ (P3 not affected: <reason>)

Verification:
- bun run check ✅
- bun run e2e ✅ | not run: <reason>
- manual smoke: P5 ✅ P6 ✅ P7 ✅ | not needed: <reason>

Refs: <task ID from 10-build-plan.md>, <INV/decision IDs if relevant>
```
- **type:** `feat` · `fix` · `test` · `refactor` · `docs` · `chore` · `build` · `contract`
- **scope:** `contracts` · `core` · `rn` · `mobile` · `server` · `scripts` · `ens` · `docs` · `repo`
- Explain *why*, not just *what*. Name exact files, functions and fields.

Example:
```
feat(core): reject requests whose ENS name isn't a direct tap.eth subname

Why:
- A scammer could register yoyogi-market.eth and pass name→address
  resolution. Verification must only trust names issued under tap.eth.

What changed:
- packages/core/src/verify/ens.ts: add isUnderParent() (normalize, then
  exact match on ^[a-z0-9-]{3,32}\.tap\.eth$, no edge hyphens)
- packages/core/src/verify/verify-request.ts: call isUnderParent() as
  step 6, before any ENS network call; return "not_under_parent"
- packages/core/test/verify/ens.test.ts: accept/reject table (INV-04)

What did NOT change:
- VerifyResult/VerifyFailure types (not_under_parent already existed)
- Wire format, contracts, @tap/react-native, apps/mobile
- Protected flows re-checked: P1 ✅ P2 ✅

Verification:
- bun run check ✅
- bun run e2e ✅ (e2e-merchant.tap.eth still verifies)
- manual smoke: not needed (no app/transport change)

Refs: S8, INV-04
```

### No AI attribution (INV-20)
Commits and PRs must not contain `Co-Authored-By: Claude …`, `Generated with Claude Code`, `Claude-Session:` or any `noreply@anthropic.com` trailer. The author is the human who commits. Enforced three ways:
1. `.claude/settings.json` (committed) turns attribution off for Claude Code:
   ```json
   {
     "attribution": { "commit": "", "pr": "" },
     "includeCoAuthoredBy": false
   }
   ```
   Check these keys against the current Claude Code settings docs; attribution settings have been reported as not always honoured, which is why 2 and 3 exist.
2. `.githooks/commit-msg` rejects the commit (below).
3. CI runs the same hook over every commit in a PR.

### Hooks (`.githooks/`, enable once per clone with `bun run hooks:install`)
`.githooks/pre-commit`:
```sh
#!/bin/sh
set -e
bun run check
```
`.githooks/commit-msg`:
```sh
#!/bin/sh
f="$1"
subject=$(head -n1 "$f")
case "$subject" in Merge*|Revert*) exit 0 ;; esac

if grep -qiE 'co-authored-by:.*(claude|anthropic)|generated with.*claude|claude-session|noreply@anthropic\.com' "$f"; then
  echo "✗ commit-msg: AI attribution lines are not allowed (INV-20)." >&2; exit 1
fi
echo "$subject" | grep -qE '^(feat|fix|test|refactor|docs|chore|build|contract)\((contracts|core|rn|mobile|server|scripts|ens|docs|repo)\): .{1,72}$' \
  || { echo "✗ subject must be '<type>(<scope>): <summary ≤72>'" >&2; exit 1; }
for s in "Why:" "What changed:" "What did NOT change:" "Verification:"; do
  grep -q "^$s" "$f" || { echo "✗ missing section: $s" >&2; exit 1; }
done
```
Both files must be executable (`chmod +x .githooks/*`).

### Branches and PRs
- `main` is always green and demo-able.
- Branches: `sdk/<topic>` or `flow/<topic>`. Rebase on `main` before merging. Delete after merge.
- PR description: the same four sections as the commit template, plus the list of commits. No AI attribution.
- Contract redeploy → one commit that updates `chains.ts` and regenerates `abi.ts`. Tell your teammate immediately.

## 5. When something breaks
1. **Stop adding features.** A broken protected flow is the top priority.
2. Find the commit: `git log --oneline`, then `git bisect` if unclear. Small commits make this fast.
3. Prefer `git revert <sha>` to get `main` green again, then fix properly in a new commit with a regression test.
4. Never "fix forward" by loosening a test or an invariant.

## 6. CI (`.github/workflows/check.yml`)
```yaml
name: check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive, fetch-depth: 0 }
      - uses: oven-sh/setup-bun@v2
      - uses: foundry-rs/foundry-toolchain@v1
      - run: bun install --frozen-lockfile
      - run: bun run check
      - name: commit messages
        if: github.event_name == 'pull_request'
        run: |
          for sha in $(git rev-list ${{ github.event.pull_request.base.sha }}..${{ github.event.pull_request.head.sha }}); do
            git log -1 --format=%B "$sha" > /tmp/msg && sh .githooks/commit-msg /tmp/msg
          done
```
