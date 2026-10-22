"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const W = 1200;
const H = 630;

// Hex equivalents of the paper/cert theme tokens in app/globals.css —
// canvas fillStyle can't read CSS custom properties, so these are pinned
// here to stay visually consistent with the rest of the app.
const COLORS = {
  cert: "#FFF4CF",
  goldD: "#121310",
  ink: "#121310",
  ink2: "#575951",
  line: "#C6C8BE",
  slip: "#FAFAF6",
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function draw(canvas: HTMLCanvasElement, amount: number, batchId: number | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Ensure the real webfonts are active before drawing text — otherwise
  // canvas silently falls back to a system font on the very first paint.
  await document.fonts.load("800 120px Archivo");
  await document.fonts.load("700 22px 'IBM Plex Mono'");
  await document.fonts.load("500 22px 'IBM Plex Mono'");
  await document.fonts.ready;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = COLORS.cert;
  ctx.fillRect(0, 0, W, H);

  // Outer gold-dark border + inset outline, mirrors .certbig
  ctx.strokeStyle = COLORS.goldD;
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = "#CFF23A";
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, W - 60, H - 60);

  // Dot grid texture (subtle), matching the app's paper feel
  ctx.fillStyle = "rgba(18,19,16,0.06)";
  for (let y = 70; y < H - 70; y += 22) {
    for (let x = 70; x < W - 70; x += 22) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // "Stake" wordmark top-left
  ctx.fillStyle = COLORS.ink;
  ctx.font = "800 30px Archivo";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("STAKE", 70, 90);
  ctx.fillStyle = COLORS.ink2;
  ctx.font = "500 15px 'IBM Plex Mono'";
  ctx.fillText("PREDICTION PROTOCOL · ROBINHOOD L1", 70, 112);

  // "CLAIMED" rotated stamp, top-right
  ctx.save();
  ctx.translate(W - 150, 95);
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.strokeStyle = COLORS.goldD;
  ctx.lineWidth = 4;
  roundRect(ctx, -95, -32, 190, 56, 8);
  ctx.stroke();
  ctx.fillStyle = COLORS.goldD;
  ctx.font = "800 26px Archivo";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CLAIMED", 0, 0);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Headline amount
  ctx.fillStyle = COLORS.ink;
  ctx.font = "800 150px Archivo";
  const amountStr = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  ctx.fillText(amountStr, 68, 330);

  ctx.font = "700 36px Archivo";
  ctx.fillStyle = COLORS.ink2;
  ctx.fillText("STAKE", 70, 380);

  // Subline
  ctx.font = "500 20px 'IBM Plex Mono'";
  ctx.fillStyle = COLORS.ink2;
  const sub = batchId !== null
    ? `Claimed from treasury purchase batch #${batchId + 1} — net-loss points converted to STAKE.`
    : "Net-loss points converted to a real STAKE allocation, claimed to wallet.";
  ctx.fillText(sub, 70, 430);

  // Divider
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(70, 470);
  ctx.lineTo(W - 70, 470);
  ctx.stroke();

  // Tagline + date footer
  ctx.font = "italic 500 22px Archivo";
  ctx.fillStyle = COLORS.ink;
  ctx.fillText("Win the bet. Lose into ownership.", 70, 520);

  ctx.font = "500 15px 'IBM Plex Mono'";
  ctx.fillStyle = COLORS.ink2;
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  ctx.fillText(`Claimed on ${dateStr} · Robinhood Chain Testnet`, 70, 548);
}

export default function ClaimShareCard({
  amount,
  batchId,
  onClose,
}: {
  amount: number;
  batchId: number | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState<"save" | "copy" | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw(canvas, amount, batchId).catch(() => {});
  }, [amount, batchId]);

  function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => canvasRef.current?.toBlob((b) => resolve(b), "image/png"));
  }

  async function handleSave() {
    setBusy("save");
    try {
      const blob = await toBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stake-claim-${Math.round(amount)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy() {
    setBusy("copy");
    try {
      const blob = await toBlob();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      // Clipboard image writes need a secure context / browser support —
      // fail silently rather than block the rest of the share flow.
    } finally {
      setBusy(null);
    }
  }

  function handleShareX() {
    const text = `Just claimed ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} STAKE on @StakeProtocol — net-loss points, converted to real tokens. Win the bet. Lose into ownership.`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Portal straight to document.body — <main> establishes its own stacking
  // context (position:relative + z-index:2 in globals.css), which traps
  // any z-index set on a descendant overlay below the sidebar's z-index:20
  // (the sidebar lives outside <main>, as a sibling under <Header/>).
  // Rendering outside that subtree is the only way for the dark backdrop
  // to actually cover the sidebar too.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Share your STAKE claim" onClick={onClose}>
      <div className="share-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-card-hd">
          <b>STAKE claimed</b>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="share-card-canvas-wrap">
          <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", height: "auto", display: "block" }} />
        </div>
        <div className="share-card-actions">
          <button className="btn sm" disabled={busy !== null} onClick={handleSave}>
            {busy === "save" ? "Saving…" : "Save image"}
          </button>
          <button className="btn sm ghost" disabled={busy !== null} onClick={handleCopy}>
            {copyOk ? "Copied!" : busy === "copy" ? "Copying…" : "Copy image"}
          </button>
          <button className="btn sm gold" onClick={handleShareX}>
            Share on X
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
