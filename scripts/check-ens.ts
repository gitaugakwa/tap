/**
 * Protected flow P4: the demo merchant names resolve correctly on live Sepolia.
 *
 * Resolves each name through the public ENS path, exactly as a customer's wallet
 * does, and asserts it carries an address and a display name. Run with
 * `bun run ens:check`. Exits non-zero on any failure.
 */
import { createPublicClient, getAddress, http } from "viem";
import { sepolia } from "viem/chains";
import { ENS_PARENT } from "../packages/core/src/config/chains";

const LABELS = ["yoyogi-market", "e2e-merchant"];

const rpc = process.env.SEPOLIA_RPC;
if (!rpc) throw new Error("Missing SEPOLIA_RPC in .env");

const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });

let failures = 0;

for (const label of LABELS) {
  const name = `${label}.${ENS_PARENT}`;
  try {
    const [address, display] = await Promise.all([
      publicClient.getEnsAddress({ name }),
      publicClient.getEnsText({ name, key: "name" }),
    ]);

    const hasAddress =
      address !== null && getAddress(address) !== getAddress(`0x${"0".repeat(40)}`);
    const hasDisplay = display !== null && display.length > 0;

    if (hasAddress && hasDisplay) {
      console.log(`✓ ${name}`);
      console.log(`    addr ${address}`);
      console.log(`    name ${display}`);
    } else {
      failures++;
      console.log(`✗ ${name}`);
      console.log(`    addr ${address ?? "unresolved"}`);
      console.log(`    name ${display ?? "unset"}`);
    }
  } catch (error) {
    failures++;
    console.log(`✗ ${name}`);
    console.log(`    ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  console.log(`\n${failures} of ${LABELS.length} names did not resolve, so P4 is not green yet.`);
  console.log("yoyogi-market is expected to be missing until J1: it is registered to the merchant");
  console.log("phone's own address, which only exists once the app has generated its key.");
  process.exit(1);
}
console.log(`\nAll ${LABELS.length} names resolve. P4 green.`);
