import { type Address, formatEther, getAddress, parseAbi } from "viem";
import { PAYMENT_CHAIN_ID, paymentChains } from "../config/chains";
import { getPaymentClient } from "../config/clients";
import { formatAmount } from "../format";
import type { WalletBalances } from "../types";

const balanceAbi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

export async function getWalletBalances(address: Address): Promise<WalletBalances> {
  const client = getPaymentClient();
  const tokenConfigs = Object.entries(paymentChains[PAYMENT_CHAIN_ID].tokens).map(
    ([token, config]) => ({ address: getAddress(token), ...config }),
  );
  const [gas, ...tokenAmounts] = await Promise.all([
    client.getBalance({ address }),
    ...tokenConfigs.map((token) =>
      client.readContract({
        address: token.address,
        abi: balanceAbi,
        functionName: "balanceOf",
        args: [address],
      }),
    ),
  ]);

  return {
    gas: { symbol: "ETH", amount: gas, display: formatEther(gas) },
    tokens: tokenConfigs.map((token, index) => {
      const amount = tokenAmounts[index];
      if (amount === undefined) throw new Error(`Missing balance for ${token.symbol}`);
      return {
        address: token.address,
        symbol: token.symbol,
        amount,
        display: formatAmount(amount, token.address),
      };
    }),
  };
}
