/**
 * Idempotent ENSv2 namespace setup for the Tap parent name (docs/04, Step 1).
 *
 * Every step reads live chain state first and skips itself if already done, so this
 * is safe to re-run. Run with `bun run ens:setup`.
 */
import {
  type Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  keccak256,
  namehash,
  parseAbi,
  toHex,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ENS_PARENT, ensConfig } from "../packages/core/src/config/chains";

// ENSv2 Sepolia beta. Setup-only: never read by the SDK or the app.
//
// These come from two sources, which is deliberate and was established by probing
// the live chain rather than trusting either one:
//   - Registry and factory are docs/04's. The parent name genuinely lives in this
//     registry, and this factory verifies the parent's existing resolver proxy.
//   - The UserRegistry implementation is the one recorded in the vendored
//     contracts-v2 checkout, NOT docs/04's. docs/04's implementation predates the
//     current UserRegistry: it has no initialize(address,uint256) selector (it
//     takes the array form docs/04 documents) and deployProxy against it reverts.
//     The vendored one matches the source TapMerchantRegistrar is compiled
//     against, which is the consistency that actually matters.
const ETH_REGISTRY = getAddress("0x657ea849311d3d5823348dded7c2aaafb3ede09e");
const VERIFIABLE_FACTORY = getAddress("0x9e726eb570beb6bceb495ab8cda7df517d4e841c");
const USER_REGISTRY_IMPL = getAddress("0x840fa461059862ea466a711e8c98c8de732061c0");

// EnhancedAccessControl role bitmaps (nybble-packed; see RegistryRolesLib and
// PermissionedResolverLib in the vendored contracts-v2).
const ROLE_REGISTRAR = 1n << 0n; // registry: may register names
const ROLE_SET_ADDR = 1n << 0n; // resolver: may write address records
const ROLE_SET_TEXT = 1n << 4n; // resolver: may write text records
const RESOLVER_ROLES = ROLE_SET_ADDR | ROLE_SET_TEXT;
// Every role plus its admin: one bit per nybble.
const ALL_ROLES = BigInt(`0x${"1".repeat(64)}`);

const STATUS_REGISTERED = 2;

const registryAbi = parseAbi([
  "function getState(uint256 anyId) view returns ((uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource))",
  "function getResolver(string label) view returns (address)",
  "function getSubregistry(string label) view returns (address)",
  "function setSubregistry(uint256 anyId, address registry)",
  "function grantRootRoles(uint256 roleBitmap, address account) returns (bool)",
  "function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)",
]);

const factoryAbi = parseAbi([
  "function deployProxy(address implementation, uint256 salt, bytes data) returns (address)",
]);

const userRegistryInitAbi = parseAbi([
  "function initialize(address rootAccount, uint256 roleBitmap)",
]);

const registrarAbi = parseAbi(["function isAvailable(string label) view returns (bool)"]);

function required(name: string): string {
  const value = process.env[name];
  // Throwing rather than logging: printing a variable whose name ends in _PK
  // would trip the INV-16 scan in check-architecture.ts.
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

const account = privateKeyToAccount(required("ENS_OWNER_PK") as `0x${string}`);
const transport = http(required("SEPOLIA_RPC"));
const publicClient = createPublicClient({ chain: sepolia, transport });
const walletClient = createWalletClient({ account, chain: sepolia, transport });

const label = ENS_PARENT.split(".")[0];
if (!label) throw new Error(`ENS_PARENT is malformed: ${ENS_PARENT}`);
const labelHash = BigInt(keccak256(toHex(label)));
const parentNode = namehash(ENS_PARENT);

async function waitFor(hash: `0x${string}`, what: string): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${what} reverted (tx ${hash})`);
  console.log(`   done (tx ${hash})`);
}

async function hasCode(address: Address): Promise<boolean> {
  const code = await publicClient.getCode({ address });
  return code !== undefined && code !== "0x";
}

// 1. The parent name must already be registered to us (docs/04, Step 0).
console.log(`1. parent ${ENS_PARENT}`);
const state = await publicClient.readContract({
  address: ETH_REGISTRY,
  abi: registryAbi,
  functionName: "getState",
  args: [labelHash],
});
if (state.status !== STATUS_REGISTERED) {
  throw new Error(
    `${ENS_PARENT} is not registered (status ${state.status}). Register it first: docs/04 Step 0.`,
  );
}
if (getAddress(state.latestOwner) !== account.address) {
  throw new Error(
    `${ENS_PARENT} is owned by ${state.latestOwner}, not ${account.address}. Check which key owns it.`,
  );
}
const expires = new Date(Number(state.expiry) * 1000).toISOString().slice(0, 10);
console.log(`   ok: registered to ${account.address}, expires ${expires}`);

// 2. Resolver. The ENS app deploys one when the name is registered; we reuse it
//    rather than deploying a second one behind the app's back.
console.log("2. resolver");
const resolver = getAddress(
  await publicClient.readContract({
    address: ETH_REGISTRY,
    abi: registryAbi,
    functionName: "getResolver",
    args: [label],
  }),
);
if (resolver === zeroAddress) {
  throw new Error(
    `${ENS_PARENT} has no resolver. Set one in the ENS app (https://app.ens.dev) with the owner wallet, then re-run.`,
  );
}
const controlsResolver = await publicClient.readContract({
  address: resolver,
  abi: registryAbi,
  functionName: "hasRootRoles",
  args: [ALL_ROLES, account.address],
});
if (!controlsResolver) {
  throw new Error(
    `Resolver ${resolver} is not controlled by ${account.address}, so roles cannot be granted on it.`,
  );
}
console.log(`   skip: already set to ${resolver}`);

// 3. Our UserRegistry, as the subregistry of the parent name.
console.log("3. user registry");
let userRegistry = getAddress(
  await publicClient.readContract({
    address: ETH_REGISTRY,
    abi: registryAbi,
    functionName: "getSubregistry",
    args: [label],
  }),
);
if (userRegistry === zeroAddress) {
  // simulateContract gives us deployProxy's return value (the proxy address)
  // before we broadcast, which is how we learn where it will land.
  const { result, request } = await publicClient.simulateContract({
    account,
    address: VERIFIABLE_FACTORY,
    abi: factoryAbi,
    functionName: "deployProxy",
    args: [
      USER_REGISTRY_IMPL,
      BigInt(parentNode),
      encodeFunctionData({
        abi: userRegistryInitAbi,
        functionName: "initialize",
        args: [account.address, ALL_ROLES],
      }),
    ],
  });
  console.log(`   deploying proxy to ${result}…`);
  await waitFor(await walletClient.writeContract(request), "deployProxy");
  userRegistry = getAddress(result);

  console.log("   linking as subregistry…");
  await waitFor(
    await walletClient.writeContract({
      address: ETH_REGISTRY,
      abi: registryAbi,
      functionName: "setSubregistry",
      args: [labelHash, userRegistry],
    }),
    "setSubregistry",
  );
} else {
  console.log(`   skip: already set to ${userRegistry}`);
}

// 4. The registrar. Its address is pasted into chains.ts by hand, which is the one
//    place in TypeScript an address may live (INV-15).
console.log("4. registrar");
const registrar = getAddress(ensConfig.merchantRegistrar);
if (registrar === zeroAddress || !(await hasCode(registrar))) {
  const artifact = await Bun.file(
    "contracts/out/TapMerchantRegistrar.sol/TapMerchantRegistrar.json",
  ).json();
  console.log("   deploying…");
  const deployHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object as `0x${string}`,
    args: [userRegistry, resolver, parentNode],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  if (receipt.status !== "success") throw new Error(`registrar deploy reverted (tx ${deployHash})`);
  console.log(
    `\n   TapMerchantRegistrar deployed at ${receipt.contractAddress} (tx ${deployHash})`,
  );
  console.log(
    "   Paste it into packages/core/src/config/chains.ts -> ensConfig.merchantRegistrar,",
  );
  console.log("   then re-run this script to grant its roles.\n");
  process.exit(0);
}
console.log(`   skip: already deployed at ${registrar}`);

// 5. Roles: the registrar must be able to register names and write records.
console.log("5. roles");
const hasRegistrarRole = await publicClient.readContract({
  address: userRegistry,
  abi: registryAbi,
  functionName: "hasRootRoles",
  args: [ROLE_REGISTRAR, registrar],
});
if (hasRegistrarRole) {
  console.log("   skip: registry ROLE_REGISTRAR already granted");
} else {
  console.log("   granting registry ROLE_REGISTRAR…");
  await waitFor(
    await walletClient.writeContract({
      address: userRegistry,
      abi: registryAbi,
      functionName: "grantRootRoles",
      args: [ROLE_REGISTRAR, registrar],
    }),
    "grantRootRoles(registry)",
  );
}

const hasResolverRoles = await publicClient.readContract({
  address: resolver,
  abi: registryAbi,
  functionName: "hasRootRoles",
  args: [RESOLVER_ROLES, registrar],
});
if (hasResolverRoles) {
  console.log("   skip: resolver ROLE_SET_ADDR|ROLE_SET_TEXT already granted");
} else {
  console.log("   granting resolver ROLE_SET_ADDR|ROLE_SET_TEXT…");
  await waitFor(
    await walletClient.writeContract({
      address: resolver,
      abi: registryAbi,
      functionName: "grantRootRoles",
      args: [RESOLVER_ROLES, registrar],
    }),
    "grantRootRoles(resolver)",
  );
}

// 6. Self-check: the registrar can answer an availability query through the registry.
console.log("6. self-check");
const probeAvailable = await publicClient.readContract({
  address: registrar,
  abi: registrarAbi,
  functionName: "isAvailable",
  args: ["tap-setup-probe"],
});
console.log(`   registrar.isAvailable("tap-setup-probe") -> ${probeAvailable}`);

console.log(`
summary
  parent          ${ENS_PARENT} (node ${parentNode})
  owner           ${account.address}
  ETHRegistry     ${ETH_REGISTRY}
  resolver        ${resolver}
  user registry   ${userRegistry}
  registrar       ${registrar}
  ready           ${probeAvailable ? "yes" : "no - probe label unexpectedly taken"}
`);
