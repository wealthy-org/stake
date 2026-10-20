"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useWallet } from "./providers";

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/app",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.2 12 3l9 8.2" />
        <path d="M5.5 9.5V20h13V9.5" />
      </svg>
    ),
  },
  {
    href: "/app/markets",
    label: "Markets",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 20v-7M12 20V5M19 20v-10" />
      </svg>
    ),
  },
  {
    href: "/app/portfolio",
    label: "Slips",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
      </svg>
    ),
  },
  {
    href: "/app/paper",
    label: "STAKE",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.7 20 7v10l-8 4.3L4 17V7z" />
      </svg>
    ),
  },
  {
    href: "/app/activity",
    label: "Tape",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: "/app/stats",
    label: "Ledger",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
        <path d="M3.5 10h17M9.5 4.5v15" />
      </svg>
    ),
  },
];

function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connectInjected, connectTestAddress, connecting } = useWallet();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={"modal" + (open ? " open" : "")} aria-hidden={!open} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="slip" role="dialog" aria-modal="true" aria-labelledby="mt">
        <div className="slip-h">
          <b id="mt">Connect a wallet</b>
        </div>
        <p style={{ color: "var(--ink2)", fontSize: 14, marginBottom: 14 }}>
          Stake works with any EVM wallet on Robinhood Chain. No real funds move yet — this phase uses a
          virtual testnet balance per address.
        </p>
        <button
          className="wopt"
          disabled={connecting}
          onClick={async () => {
            await connectInjected();
            onClose();
          }}
        >
          <div className="wopt-icon" style={{ background: "#F6851B" }}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path d="M29.5 2L18.5 10.2L20.6 5.3L29.5 2Z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.5 2L13.4 10.3L11.4 5.3L2.5 2Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M25.4 22.8L22.6 27.2L28.8 28.9L30.6 22.9C30.6 22.8 25.4 22.8 25.4 22.8Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1.4 22.9L3.2 28.9L9.4 27.2L6.6 22.8C6.6 22.8 1.4 22.8 1.4 22.9Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.1 14.1L7.2 16.9L13.3 17.2L13.1 10.6L9.1 14.1Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22.9 14.1L18.8 10.5L18.7 17.2L24.8 16.9L22.9 14.1Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.4 27.2L12.9 25.4L10 21.5L9.4 27.2Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.1 25.4L22.6 27.2L22 21.5L19.1 25.4Z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22.6 27.2L19.1 25.4L19.5 28.5L19.4 29.8L22.6 27.2Z" fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.4 27.2L12.6 29.8L12.5 28.5L12.9 25.4L9.4 27.2Z" fill="#D7C1B3" stroke="#D7C1B3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12.7 21.9L8.7 20.7L6.6 22.8L10 21.5L12.7 21.9Z" fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.3 21.9L22 21.5L25.4 22.8L23.3 20.7L19.3 21.9Z" fill="#233447" stroke="#233447" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 21.5L19.1 25.4L22.6 27.2L22 21.5Z" fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 21.5L9.4 27.2L12.9 25.4L10 21.5Z" fill="#CD6116" stroke="#CD6116" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.7 17.2L18.8 10.5L16 6.5L13.1 10.6L13.3 17.2L16 19.3L18.7 17.2Z" fill="#E4751F" stroke="#E4751F" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span>
            Browser EVM Wallet
            <small>MetaMask, Robinhood Wallet, Rabby, etc.</small>
          </span>
        </button>
        <button
          className="wopt"
          onClick={() => {
            connectTestAddress();
            onClose();
          }}
        >
          <div className="wopt-icon" style={{ background: "#2631A6" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F3F6EE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5-2 2L14 9l-4 4H7v3H4v3H1l2.5 2.5a2.12 2.12 0 0 0 3 0L17 8.5l1.5 1.5 2-2L19 6.5l1.5-1.5"/>
              <circle cx="16.5" cy="7.5" r=".5" fill="#F3F6EE"/>
            </svg>
          </div>
          <span>
            Ephemeral Test Key
            <small>Simulated local address, zero signature required</small>
          </span>
        </button>
        <div className="perf"></div>
        <div style={{ padding: "12px 0 18px" }}>
          <button className="btn ghost block" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { address, disconnect, isOnChain, chainId, switchToRobinhood } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;
  const isWrongChain = isOnChain && chainId !== 46630;

  return (
    <>
      <aside className="app-sidebar">
        <Link className="brand" href="/app" aria-label="Stake home">
          <Image src="/logo.jpeg" alt="Stake" width={40} height={40} className="brand-mark" priority />
          <div className="brand-text">
            <span className="brand-name">Stake</span>
            <span className="brand-sub">Prediction Protocol · Robinhood L1</span>
          </div>
        </Link>

        <nav className="sidebar-nav" aria-label="Main">
          <span className="sidebar-label" aria-hidden="true">
            Menu
          </span>
          {NAV.map(({ href, label, icon }) => (
            <Link key={href} href={href} className={pathname === href ? "on" : ""} aria-current={pathname === href ? "page" : undefined}>
              {icon}
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          {isWrongChain ? (
            <button
              className="pill net"
              style={{ background: "#FFE2D9", color: "#CF3520", cursor: "pointer", border: "1px solid #CF3520" }}
              title="Click to switch to Robinhood Chain Testnet"
              onClick={switchToRobinhood}
            >
              <i style={{ background: "#CF3520" }}></i>Switch to 46630
            </button>
          ) : (
            <span className="pill net" title="Robinhood Chain Testnet, chain ID 46630">
              <i style={isOnChain ? { boxShadow: "0 0 8px var(--lime)" } : undefined}></i>
              {isOnChain ? "On-Chain 46630" : "Testnet 46630"}
            </span>
          )}
          <button
            className={"btn conn block " + (address ? "ghost" : "gold")}
            onClick={() => (address ? disconnect() : setModalOpen(true))}
          >
            {short ?? "Connect wallet"}
          </button>
        </div>
      </aside>
      <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
