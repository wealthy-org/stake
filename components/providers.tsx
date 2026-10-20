"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { WagmiProvider, useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/web3/wagmi";
import { robinhoodTestnet } from "@/lib/web3/chains";
import { getWallet, faucet } from "@/lib/client/api";
import type { WalletSummary } from "@/lib/client/types";

const ROBINHOOD_CHAIN_PARAMS = {
  chainId: "0xb626", // 46630 in hex
  chainName: "Robinhood Chain Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.testnet.chain.robinhood.com"],
  blockExplorerUrls: ["https://explorer.testnet.chain.robinhood.com"],
};

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
      if (typeof window === "undefined") return;

      const hasEthereum = typeof (window as any).ethereum !== "undefined";
      const injectedConnector = connectors.find((c) => c.type === "injected") || connectors[0];

      if (!hasEthereum || !injectedConnector) {
        showToast("No Web3 wallet detected — using a generated test address instead");
        connectTestAddress();
        return;
      }

      // 1. Connect without strictly forcing chain upfront
      await connectAsync({
        connector: injectedConnector,
      });

      setTestAddress(null);
      try {
        localStorage.removeItem("pb-test-address");
      } catch {}

      // 2. Attempt chain switch / add
      try {
        await switchChainAsync({ chainId: robinhoodTestnet.id });
        showToast("Connected to Robinhood Chain Testnet");
      } catch (switchErr: any) {
        console.warn("Chain switch note:", switchErr);
        if (
          switchErr?.code === 4902 ||
          switchErr?.message?.toLowerCase().includes("unrecognized") ||
          switchErr?.message?.toLowerCase().includes("not added")
        ) {
          try {
            await (window as any).ethereum.request({
              method: "wallet_addEthereumChain",
              params: [ROBINHOOD_CHAIN_PARAMS],
            });
            showToast("Added and connected to Robinhood Chain Testnet");
          } catch {
            showToast("Connected! Switch wallet to Robinhood Chain (46630)");
          }
        } else {
          showToast("Connected! Switch wallet to Robinhood Chain (46630)");
        }
      }
    } catch (err: any) {
      console.error("connectInjected error:", err);
      if (err?.message?.toLowerCase().includes("rejected") || err?.message?.toLowerCase().includes("user rejected")) {
        showToast("Wallet connection was cancelled");
      } else {
        showToast(err?.message || "Wallet connection error. Using test key instead.");
        connectTestAddress();
      }
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
    // Auto-fund test address with $1,000 virtual balance so user can test immediately!
    faucet(addr, "1000000000")
      .then(() => refresh())
      .catch(() => {});
    showToast("Connected with test address + $1,000 virtual balance!");
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
      if (
        err?.code === 4902 ||
        err?.message?.toLowerCase().includes("unrecognized") ||
        err?.message?.toLowerCase().includes("not added")
      ) {
        try {
          await (window as any).ethereum?.request?.({
            method: "wallet_addEthereumChain",
            params: [ROBINHOOD_CHAIN_PARAMS],
          });
          showToast("Added and switched to Robinhood Chain Testnet");
          return;
        } catch (addErr: any) {
          showToast(addErr?.message || "Failed to add chain");
          return;
        }
      }
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
