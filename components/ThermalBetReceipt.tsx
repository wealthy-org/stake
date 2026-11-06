"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usd } from "@/lib/client/format";
import type { MarketRow } from "@/lib/client/types";

interface ThermalBetReceiptProps {
  market: MarketRow;
  side: "yes" | "no";
  amount: number;
  estPayout: number;
  estStakeLoss: number;
  signature?: string;
  txHash?: string;
  onClose: () => void;
}

export default function ThermalBetReceipt({
  market,
  side,
  amount,
  estPayout,
  estStakeLoss,
  signature,
  txHash,
  onClose,
}: ThermalBetReceiptProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const now = new Date();

  useEffect(() => {
    setMounted(true);
  }, []);
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const shareText = `Just placed a $${amount} bet on "${side.toUpperCase()}" for "${market.question}" on @stakemarket_ (Robinhood Chain)!\n\nOutcome locked. Win USDG or mint $STAKE on loss. 🎟️⚡`;

  function copyShare() {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shortSig = signature ? `${signature.slice(0, 10)}...${signature.slice(-8)}` : txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : "0x7a8f...92e1";

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal open"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="receipt-slip-container"
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FAFAF6",
          color: "#0E0E10",
          fontFamily: "'IBM Plex Mono', monospace",
          borderRadius: 4,
          padding: "24px 28px 28px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.1)",
          position: "relative",
          animation: "receiptSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Top jagged tear edge simulation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "2px dashed #D0D0C8",
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>STAKE PROTOCOL</div>
            <div style={{ fontSize: 11, color: "#666" }}>ROBINHOOD CHAIN · ON-CHAIN BET SLIP</div>
          </div>
          <div
            style={{
              background: side === "yes" ? "#D1FAE5" : "#FEE2E2",
              color: side === "yes" ? "#065F46" : "#991B1B",
              fontWeight: 800,
              fontSize: 16,
              padding: "4px 12px",
              borderRadius: 3,
            }}
          >
            {side.toUpperCase()}
          </div>
        </div>

        {/* Market Question */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>
            MARKET / QUESTION
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: "#111" }}>
            {market.question}
          </div>
        </div>

        {/* Data Rows */}
        <div
          style={{
            borderTop: "1px solid #E5E5DF",
            borderBottom: "1px solid #E5E5DF",
            padding: "14px 0",
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>STAKE AMOUNT</span>
            <span style={{ fontWeight: 700 }}>${amount.toFixed(2)} USDG</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>EST. PAYOUT IF WIN</span>
            <span style={{ fontWeight: 800, color: "#059669" }}>${estPayout.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>REBATE IF LOSS</span>
            <span style={{ fontWeight: 700, color: "#D97706" }}>+{estStakeLoss.toLocaleString()} $STAKE</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>SIGNATURE HASH</span>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#444" }}>{shortSig}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>TIMESTAMP</span>
            <span style={{ color: "#444" }}>{dateStr} {timeStr}</span>
          </div>
        </div>

        {/* Barcode representation */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              height: 38,
              background: "repeating-linear-gradient(90deg, #111 0, #111 2px, transparent 2px, transparent 5px, #111 5px, #111 8px, transparent 8px, transparent 10px, #111 10px, #111 14px)",
              opacity: 0.85,
              borderRadius: 2,
              marginBottom: 6,
            }}
          />
          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#666" }}>
            {market.id.replace("mkt_", "").toUpperCase()} · EIP712 VERIFIED
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={copyShare}
            style={{
              flex: 1,
              padding: "11px 0",
              background: "#0E0E10",
              color: "#FFF",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied Share Text!" : "Share to X (Twitter)"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "11px 20px",
              background: "#E5E5DF",
              color: "#333",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

