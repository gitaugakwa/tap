/**
 * Issues a merchant subname under the Tap parent name (docs/04, Step 2).
 *
 * Usage:
 *   bun run ens:register -- --label yoyogi-market --owner 0x… --display "Takoyaki Stand"
 *
 * Anyone may call the registrar; ENS_OWNER is used here simply because it holds
 * the Sepolia gas.
 */
import { createPublicClient, createWalletClient, getAddress, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { tapMerchantRegistrarAbi } from "../packages/core/src/config/abi";
import { ENS_PARENT, ensConfig } from "../packages/core/src/config/chains";

function required(name: string): string {
  const value = process.env[name];
  // Throwing rather than logging: a console line naming a *_PK variable trips INV-16.
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function flag(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) {
    throw new Error(
      `Missing --${name}. Usage: bun run ens:register -- --label <label> --owner <0x…> --display "<name>"`,
    );
  }
  return value;
}

const label = flag("label");
const ownerArg = flag("owner");
const display = flag("display");

if (!isAddress(ownerArg)) throw new Error(`--owner is not an address: ${ownerArg}`);
const owner = getAddress(ownerArg);

const registrar = getAddress(ensConfig.merchantRegistrar);
const name = `${label}.${ENS_PARENT}`;

const account = privateKeyToAccount(required("ENS_OWNER_PK") as `0x${string}`);
const transport = http(required("SEPOLIA_RPC"));
const publicClient = createPublicClient({ chain: sepolia, transport });
const walletClient = createWalletClient({ account, chain: sepolia, transport });

console.log(`registering ${name}`);
console.log(`  owner   ${owner}`);
console.log(`  display ${display}`);

const available = await publicClient.readContract({
  address: registrar,
  abi: tapMerchantRegistrarAbi,
  functionName: "isAvailable",
  args: [label],
});
if (!available) throw new Error(`${name} is already taken`);

// simulateContract surfaces InvalidLabel / InvalidDisplayName before spending gas.
const { request } = await publicClient.simulateContract({
  account,
  address: registrar,
  abi: tapMerchantRegistrarAbi,
  functionName: "register",
  args: [label, owner, display],
});
const hash = await walletClient.writeContract(request);
console.log(`  tx ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error(`register reverted (tx ${hash})`);
console.log("  registered");

// Verify through the public resolution path rather than our own storage: this is
// what a customer's wallet will actually do.
const resolved = await publicClient.getEnsAddress({ name });
const resolvedDisplay = await publicClient.getEnsText({ name, key: "name" });

const addressOk = resolved !== null && getAddress(resolved) === owner;
const displayOk = resolvedDisplay === display;

console.log(`\n  ${addressOk ? "✓" : "✗"} addr  ${resolved ?? "unresolved"}`);
console.log(`  ${displayOk ? "✓" : "✗"} name  ${resolvedDisplay ?? "unset"}`);

if (!addressOk || !displayOk) {
  throw new Error(
    `${name} does not resolve as expected yet. Records may need a moment, or the resolver roles are missing.`,
  );
}
console.log(`\n${name} is live.`);
