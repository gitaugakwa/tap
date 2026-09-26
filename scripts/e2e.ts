/**
 * Protected flow P3. This submits a real $0.01 USDC payment on Base Sepolia.
 * It never prints private keys, request signatures, or permit signatures.
 */
import { type Address, createPublicClient, type Hex, http } from "viem";
import { tapPayAbi } from "../packages/core/src/config/abi";
import {
  configureTap,
  decodeRequestUrl,
  encodeRequestUrl,
  getPaymentChain,
  hashRequest,
  isPaid,
  newChargeRequest,
  PAYMENT_CHAIN_ID,
  payWithPermit,
  privateKeyToAccount,
  signRequest,
  TapPayError,
  verifyRequest,
  waitForPayment,
} from "../packages/core/src/index";
import { tamperRequestUrl } from "../packages/core/src/testing";

const E2E_MERCHANT_NAME = "e2e-merchant.tap.eth";
const E2E_AMOUNT = 10_000n;
const PAID_STATE_ATTEMPTS = 20;
const PAID_STATE_INTERVAL_MS = 500;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pass(message: string): void {
  console.log(`[ok] ${message}`);
}

async function waitUntilPaid(merchant: Address, nonce: Hex): Promise<void> {
  for (let attempt = 0; attempt < PAID_STATE_ATTEMPTS; attempt += 1) {
    try {
      if (await isPaid(merchant, nonce)) return;
    } catch {
      // Confirmed receipts can become visible before a load-balanced RPC serves the new state.
    }
    await Bun.sleep(PAID_STATE_INTERVAL_MS);
  }
  throw new Error("TapPay paid state was not visible after a confirmed payment");
}

const baseRpc = required("BASE_SEPOLIA_RPC");
const sepoliaRpc = required("SEPOLIA_RPC");
const merchant = privateKeyToAccount(required("MERCHANT_PK") as Hex);
const customer = privateKeyToAccount(required("CUSTOMER_PK") as Hex);
const paymentConfig = getPaymentChain(PAYMENT_CHAIN_ID);
assert(paymentConfig, `Missing payment configuration for chain ${PAYMENT_CHAIN_ID}`);

configureTap({ rpcUrls: { payment: baseRpc, ens: sepoliaRpc } });
const paymentClient = createPublicClient({
  chain: paymentConfig.chain,
  transport: http(baseRpc),
});

console.log("Tap live e2e");
console.log(`  merchant ${merchant.address}`);
console.log(`  customer ${customer.address}`);
console.log(`  amount   $0.01 USDC`);

const request = newChargeRequest({
  merchant: merchant.address,
  merchantName: E2E_MERCHANT_NAME,
  amount: E2E_AMOUNT,
});
const signed = await signRequest(request, merchant);
const encoded = encodeRequestUrl(signed);
const decoded = decodeRequestUrl(encoded);
assert(
  decoded.chainId === signed.chainId &&
    decoded.signature === signed.signature &&
    decoded.request.merchant === signed.request.merchant &&
    decoded.request.merchantName === signed.request.merchantName &&
    decoded.request.token === signed.request.token &&
    decoded.request.amount === signed.request.amount &&
    decoded.request.expiry === signed.request.expiry &&
    decoded.request.nonce === signed.request.nonce,
  "Request URL did not roundtrip",
);
pass("request signed and URL roundtripped");

const verified = await verifyRequest(decoded);
if (!verified.ok) throw new Error(`Live merchant verification failed: ${verified.reason}`);
assert(verified.ensName === E2E_MERCHANT_NAME, "Verified ENS name changed unexpectedly");
pass(`ENS verified ${verified.displayName ?? verified.ensName}`);

const tampered = decodeRequestUrl(tamperRequestUrl(encoded, "a"));
const tamperedResult = await verifyRequest(tampered);
assert(!tamperedResult.ok, "Tampered request was accepted");
pass(`tampered request rejected (${tamperedResult.reason})`);

const localDigest = hashRequest(decoded.request, decoded.chainId);
const contractDigest = await paymentClient.readContract({
  address: paymentConfig.tapPay,
  abi: tapPayAbi,
  functionName: "hashRequest",
  args: [decoded.request],
});
assert(contractDigest === localDigest, "Live TapPay hash does not match the SDK digest");
pass("live SDK and TapPay hashes match");

const transaction = await payWithPermit(decoded, customer);
console.log(`  payment  ${transaction}`);
const receipt = await waitForPayment(transaction);
assert(receipt === "success", `Payment transaction ${transaction} reverted`);
pass("payment confirmed");

await waitUntilPaid(decoded.request.merchant, decoded.request.nonce);
pass("isPaid returned true");

try {
  await payWithPermit(decoded, customer);
  throw new Error("Replay unexpectedly succeeded");
} catch (error) {
  if (!(error instanceof TapPayError) || error.code !== "already_paid") throw error;
}
pass("replay rejected (already_paid)");

console.log(
  "\nP3 passed: live ENS verification, settlement, replay defense, tamper defense, hash parity.",
);
