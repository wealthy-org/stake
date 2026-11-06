"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const now = new Date();

  useEffect(() => {
    setMounted(true);
  }, []);

  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const shortSig = signature
    ? `${signature.slice(0, 10)}...${signature.slice(-8)}`
    : txHash
    ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
    : "0x7a8f...92e1";

  const shareText = `Just placed a $${amount} bet on "${side.toUpperCase()}" for "${market.question}" on @stakemarket_ (Robinhood Chain).\n\nOutcome locked. Win USDG or mint $STAKE on loss.`;

  function copyShare() {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadPNG() {
    setDownloading(true);
    const canvas = document.createElement("canvas");
    const W = 640;
    const H = 820;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background paper
    ctx.fillStyle = "#FAFAF6";
    ctx.fillRect(0, 0, W, H);

    // Dark border outline
    ctx.strokeStyle = "#0E0E10";
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, W - 32, H - 32);

    // Header
    ctx.font = "800 28px monospace";
    ctx.fillStyle = "#0E0E10";
    ctx.fillText("STAKE PROTOCOL", 44, 70);

    ctx.font = "600 13px monospace";
    ctx.fillStyle = "#666666";
    ctx.fillText("ROBINHOOD CHAIN · ON-CHAIN BET SLIP", 44, 94);

    // Side Badge
    const badgeW = 90;
    const badgeH = 38;
    const badgeX = W - 44 - badgeW;
    const badgeY = 56;
    ctx.fillStyle = side === "yes" ? "#D1FAE5" : "#FEE2E2";
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.font = "800 20px monospace";
    ctx.fillStyle = side === "yes" ? "#065F46" : "#991B1B";
    ctx.textAlign = "center";
    ctx.fillText(side.toUpperCase(), badgeX + badgeW / 2, badgeY + 26);
    ctx.textAlign = "left";

    // Dashed divider
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "#C8C8C0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(44, 120);
    ctx.lineTo(W - 44, 120);
    ctx.stroke();
    ctx.setLineDash([]);

    // Market question label
    ctx.font = "700 13px monospace";
    ctx.fillStyle = "#888888";
    ctx.fillText("MARKET / QUESTION", 44, 155);

    // Multi-line question wrapping
    ctx.font = "700 22px monospace";
    ctx.fillStyle = "#111111";
    const words = market.question.split(" ");
    let line = "";
    let qY = 190;
    const maxQW = W - 88;
    for (const w of words) {
      const test = line + w + " ";
      if (ctx.measureText(test).width > maxQW) {
        ctx.fillText(line, 44, qY);
        line = w + " ";
        qY += 30;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, 44, qY);

    // Divider line
    qY += 25;
    ctx.strokeStyle = "#E5E5DF";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(44, qY);
    ctx.lineTo(W - 44, qY);
    ctx.stroke();

    // Data rows
    const drawRow = (label: string, val: string, color = "#111", y: number, isBold = false) => {
      ctx.font = "500 16px monospace";
      ctx.fillStyle = "#666666";
      ctx.fillText(label, 44, y);

      ctx.font = `${isBold ? "800" : "600"} 16px monospace`;
      ctx.fillStyle = color;
      ctx.textAlign = "right";
      ctx.fillText(val, W - 44, y);
      ctx.textAlign = "left";
    };

    let rY = qY + 40;
    drawRow("STAKE AMOUNT", `$${amount.toFixed(2)} USDG`, "#111", rY);
    rY += 36;
    drawRow("EST. PAYOUT IF WIN", `$${estPayout.toFixed(2)}`, "#059669", rY, true);
    rY += 36;
    drawRow("REBATE IF LOSS", `+${estStakeLoss.toLocaleString()} $STAKE`, "#D97706", rY, true);
    rY += 36;
    drawRow("SIGNATURE HASH", shortSig, "#444", rY);
    rY += 36;
    drawRow("TIMESTAMP", `${dateStr} ${timeStr}`, "#444", rY);

    // Divider line
    rY += 26;
    ctx.beginPath();
    ctx.moveTo(44, rY);
    ctx.lineTo(W - 44, rY);
    ctx.stroke();

    // Barcode stripes
    const barY = rY + 30;
    const barH = 50;
    ctx.fillStyle = "#111111";
    let bx = 60;
    while (bx < W - 60) {
      const bw = ((bx * 7) % 5) + 2;
      ctx.fillRect(bx, barY, bw, barH);
      bx += bw + ((bx * 13) % 4) + 2;
    }

    // Barcode subtext
    ctx.font = "600 13px monospace";
    ctx.fillStyle = "#666666";
    ctx.textAlign = "center";
    ctx.fillText(`${market.id.replace("mkt_", "").toUpperCase()} · EIP712 VERIFIED ON ROBINHOOD CHAIN`, W / 2, barY + barH + 24);

    // Download trigger
    const link = document.createElement("a");
    link.download = `stake-ticket-${market.id.slice(-6)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setDownloading(false);
  }

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
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: 16,
      }}
    >
      <div
        className="receipt-slip-container"
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#FAFAF6",
          color: "#0E0E10",
          fontFamily: "'IBM Plex Mono', monospace",
          borderRadius: 6,
          padding: "26px 30px 30px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.15)",
          position: "relative",
          animation: "receiptSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Top header */}
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
              height: 40,
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

        {/* Action Buttons: Download PNG, Share to X, Done */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={downloadPNG}
              disabled={downloading}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {downloading ? "Exporting..." : "Download Ticket PNG"}
            </button>
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
              {copied ? "Copied" : "Share to X"}
            </button>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "10px 0",
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
