"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { WagmiProvider, useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/web3/wagmi";
import { robinhoodTestnet } from "@/lib/web3/chains";
import { getWallet } from "@/lib/client/api";
import type { WalletSummary } from "@/lib/client/types";

/* ---------------- toast ---------------- */

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function ToastHost({ message }: { message: string | null }) {
  return (
    <div className={"toast" + (message ? " show" : "")} role="status" aria-live="polite">
      {message}
    </div>
  );
}

/* ---------------- wallet ---------------- */

interface WalletContextValue {
  address: string | null;
  summary: WalletSummary | null;
  connecting: boolean;
  isOnChain: boolean;
  chainId?: number;
  connectInjected: () => Promise<void>;
  connectTestAddress: () => void;
  disconnect: () => void;
  refresh: () => Promise<void>;
  switchToRobinhood: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  summary: null,
  connecting: false,
  isOnChain: false,
  chainId: undefined,
  connectInjected: async () => {},
  connectTestAddress: () => {},
  disconnect: () => {},
  refresh: async () => {},
  switchToRobinhood: async () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

function randomTestAddress(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function WalletInnerProvider({ children }: { children: React.ReactNode }) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const { address: wagmiAddress, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending: isConnectingWagmi } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const [testAddress, setTestAddress] = useState<string | null>(null);
  const [summary, setSummary] = useState<WalletSummary | null>(null);

  useEffect(() => {
    try {
      const savedTest = localStorage.getItem("pb-test-address");
      if (savedTest) setTestAddress(savedTest);
    } catch {}
  }, []);

  const activeAddress = isConnected && wagmiAddress ? wagmiAddress.toLowerCase() : testAddress;
  const isOnChain = isConnected && !!wagmiAddress;

  const refresh = useCallback(async () => {
    if (!activeAddress) {
      setSummary(null);
      return;
    }
    try {
      setSummary(await getWallet(activeAddress));
    } catch {
      // transient keep last known summary
    }
  }, [activeAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function connectInjected() {
    try {
      const injectedConnector = connectors.find((c) => c.type === "injected") || connectors[0];
      if (!injectedConnector) {
        showToast("No browser wallet found — use a test address instead");
        return;
      }
      await connectAsync({
        connector: injectedConnector,
        chainId: robinhoodTestnet.id,
      });
      setTestAddress(null);
      try {
        localStorage.removeItem("pb-test-address");
      } catch {}
      showToast("Connected to Robinhood Chain Testnet");
    } catch (err: any) {
      showToast(err?.message || "Wallet connection was cancelled");
    }
  }

  function connectTestAddress() {
    const addr = randomTestAddress();
    setTestAddress(addr);
    try {
      localStorage.setItem("pb-test-address", addr);
    } catch {}
    if (isConnected) {
      disconnectAsync().catch(() => {});
    }
    showToast("Using a generated test address — no real funds involved");
  }

  async function disconnect() {
    if (isConnected) {
      await disconnectAsync().catch(() => {});
    }
    setTestAddress(null);
    setSummary(null);
    try {
      localStorage.removeItem("pb-test-address");
    } catch {}
    showToast("Wallet disconnected");
  }

  async function switchToRobinhood() {
    try {
      await switchChainAsync({ chainId: robinhoodTestnet.id });
      showToast("Switched to Robinhood Chain Testnet");
    } catch (err: any) {
      showToast(err?.message || "Failed to switch chain");
    }
  }

  return (
    <ToastContext.Provider value={showToast}>
      <WalletContext.Provider
        value={{
          address: activeAddress,
          summary,
          connecting: isConnectingWagmi,
          isOnChain,
          chainId,
          connectInjected,
          connectTestAddress,
          disconnect,
          refresh,
          switchToRobinhood,
        }}
      >
        {children}
        <ToastHost message={toastMsg} />
      </WalletContext.Provider>
    </ToastContext.Provider>
  );
}

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletInnerProvider>{children}</WalletInnerProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
