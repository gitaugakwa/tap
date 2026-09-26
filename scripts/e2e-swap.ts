/**
 * A8 live proof. Pays an exact $0.01 USDC request with native ETH through Uniswap.
 * It never prints private keys, request signatures, or permit signatures.
 */
import { createPublicClient, type Hex, http, parseAbi, parseEventLogs } from "viem";
import { tapPayAbi, tapSwapPayAbi } from "../packages/core/src/config/abi";
import {
  configureTap,
  DEFAULT_TOKEN,
  formatTokenUnits,
  getPaymentChain,
  isPaid,
  newChargeRequest,
  PAYMENT_CHAIN_ID,
  payWithSwap,
  privateKeyToAccount,
  quoteSwap,
  signRequest,
  verifyRequest,
} from "../packages/core/src/index";

const E2E_MERCHANT_NAME = "e2e-merchant.tap.eth";
const E2E_AMOUNT = 10_000n;
const STATE_ATTEMPTS = 20;
const STATE_INTERVAL_MS = 500;
const erc20Abi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

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

async function merchantBalanceAt(blockNumber: bigint): Promise<bigint> {
  for (let attempt = 0; attempt < STATE_ATTEMPTS; attempt += 1) {
    try {
      return await paymentClient.readContract({
        address: DEFAULT_TOKEN,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [merchant.address],
        blockNumber,
      });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, STATE_INTERVAL_MS));
    }
  }
  throw new Error(`USDC balance was not readable at block ${blockNumber}`);
}

console.log("Tap Uniswap live e2e");
console.log(`  merchant ${merchant.address}`);
console.log(`  customer ${customer.address}`);
console.log("  output   $0.01 USDC");

const request = newChargeRequest({
  merchant: merchant.address,
  merchantName: E2E_MERCHANT_NAME,
  amount: E2E_AMOUNT,
});
const signed = await signRequest(request, merchant);
const verified = await verifyRequest(signed);
if (!verified.ok) throw new Error(`Live merchant verification failed: ${verified.reason}`);
pass(`ENS verified ${verified.displayName ?? verified.ensName}`);

const quote = await quoteSwap(signed, "native");
console.log(`  quoted  ${formatTokenUnits(quote.amountIn, 18, 9)} ETH`);
console.log(`  maximum ${formatTokenUnits(quote.amountInMaximum, 18, 9)} ETH`);
assert(quote.amountInMaximum >= quote.amountIn, "Maximum input is below the quote");
pass("exact-output quote is bounded");

const transaction = await payWithSwap(signed, customer, quote);
console.log(`  payment ${transaction}`);
const receipt = await paymentClient.waitForTransactionReceipt({
  hash: transaction,
  confirmations: 1,
});
assert(receipt.status === "success", `Swap payment ${transaction} reverted`);

const [merchantBefore, merchantAfter] = await Promise.all([
  merchantBalanceAt(receipt.blockNumber - 1n),
  merchantBalanceAt(receipt.blockNumber),
]);
assert(merchantAfter - merchantBefore === E2E_AMOUNT, "Merchant did not receive exact USDC output");
pass("merchant received exact signed USDC amount");

const swapEvents = parseEventLogs({
  abi: tapSwapPayAbi,
  eventName: "SwapPaid",
  logs: receipt.logs,
});
assert(swapEvents.length === 1, "Expected exactly one SwapPaid event");
const swapEvent = swapEvents[0];
assert(swapEvent, "SwapPaid event was missing");
assert(swapEvent.args.payer === customer.address, "SwapPaid payer is not the customer");
assert(swapEvent.args.merchant === merchant.address, "SwapPaid merchant changed");
assert(swapEvent.args.amountOut === E2E_AMOUNT, "SwapPaid output amount changed");
assert(swapEvent.args.amountIn <= quote.amountInMaximum, "Swap exceeded the displayed maximum");
pass("SwapPaid attributes the customer and stays under the cap");

const paidEvents = parseEventLogs({ abi: tapPayAbi, eventName: "Paid", logs: receipt.logs });
assert(paidEvents.length === 1, "Expected exactly one TapPay Paid event");
assert(paidEvents[0]?.args.nonce === request.nonce, "TapPay Paid nonce changed");
assert(await isPaid(request.merchant, request.nonce), "TapPay did not persist the paid nonce");
pass("existing TapPay watcher event and paid state remain intact");

let replayRejected = false;
try {
  await payWithSwap(signed, customer, quote);
} catch {
  replayRejected = true;
}
assert(replayRejected, "Replay unexpectedly succeeded");
pass("replay rejected atomically");

console.log(
  "\nA8 passed: exact USDC out, bounded ETH in, attribution, watcher compatibility, replay defense.",
);
