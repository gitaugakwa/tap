import { type Address, type Hex, hashTypedData } from "viem";

const types = {
  PaymentRequest: [
    { name: "merchant", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "expiry", type: "uint64" },
    { name: "merchantName", type: "string" },
  ],
} as const;

const fixture = {
  chainId: 84532,
  verifyingContract: "0x00000000000000000000000000000000000ca5e1" as Address,
  request: {
    merchant: "0x1111111111111111111111111111111111111111" as Address,
    token: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
    amount: "5000000",
    nonce: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as Hex,
    expiry: "1790000000",
    merchantName: "yoyogi-market.tap.eth",
  },
} as const;

const digest = hashTypedData({
  domain: {
    name: "TapPay",
    version: "1",
    chainId: fixture.chainId,
    verifyingContract: fixture.verifyingContract,
  },
  types,
  primaryType: "PaymentRequest",
  message: {
    ...fixture.request,
    amount: BigInt(fixture.request.amount),
    expiry: BigInt(fixture.request.expiry),
  },
});

console.log(JSON.stringify({ ...fixture, digest }, null, 2));
