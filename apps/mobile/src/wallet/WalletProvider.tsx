import type { Address, LocalAccount } from "@tap/core";
import { privateKeyToAccount } from "@tap/core";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { loadOrCreatePrivateKey, resetPrivateKey } from "./secure-key";

type WalletContextValue = {
  account: LocalAccount | null;
  address: Address | null;
  isLoading: boolean;
  resetWallet(): Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadOrCreatePrivateKey().then((key) => {
      if (cancelled) return;
      setAccount(privateKeyToAccount(key));
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      account,
      address: account?.address ?? null,
      isLoading,
      async resetWallet() {
        setAccount(privateKeyToAccount(await resetPrivateKey()));
      },
    }),
    [account, isLoading],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}
