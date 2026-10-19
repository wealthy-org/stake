"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "./providers";

const NAV = [
  ["/", "Home"],
  ["/markets", "Markets"],
  ["/portfolio", "Slips"],
  ["/paper", "PAPER"],
  ["/activity", "Tape"],
  ["/stats", "Ledger"],
] as const;

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
          Paper Bet works with any EVM wallet on Robinhood Chain. No real funds move yet — this phase uses a
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
      <header className="wrap deskbar">
        <Link className="brand" href="/" aria-label="Paper Bet home">
          <i className="mark"></i>Paper Bet
        </Link>
        {isWrongChain ? (
          <button
            className="pill net"
            style={{ background: "#FEE2E2", color: "#991B1B", cursor: "pointer", border: "1px solid #F87171" }}
            title="Click to switch to Robinhood Chain Testnet"
            onClick={switchToRobinhood}
          >
            <i></i>Switch to 46630
          </button>
        ) : (
          <span
            className="pill net"
            style={isOnChain ? { borderColor: "rgba(74, 222, 128, 0.4)", color: "#F3F6EE" } : undefined}
            title="Robinhood Chain Testnet, chain ID 46630"
          >
            <i style={isOnChain ? { background: "#4ADE80", boxShadow: "0 0 8px #4ADE80" } : undefined}></i>
            {isOnChain ? "On-Chain 46630" : "Testnet 46630"}
          </span>
        )}
        <button
          className={"btn conn " + (address ? "ghost" : "paper")}
          style={address ? { color: "var(--desk-ink)" } : undefined}
          onClick={() => (address ? disconnect() : setModalOpen(true))}
        >
          {short ?? "Connect wallet"}
        </button>
      </header>
      <div className="wrap">
        <nav className="folder" aria-label="Main">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={pathname === href ? "on" : ""}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
