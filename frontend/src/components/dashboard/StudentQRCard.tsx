"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { QrCode, Download, Printer, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentQRCardProps {
  studentNumber: string;
  studentName: string;
  beltName?: string;
  beltColor?: string;
  clubName?: string;
  /** If true, renders inline (in sidebar). If false, renders as a modal overlay */
  inline?: boolean;
  onClose?: () => void;
}

export default function StudentQRCard({
  studentNumber,
  studentName,
  beltName,
  beltColor,
  clubName = "MAIDAN",
  inline = false,
  onClose,
}: StudentQRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Generate QR code on mount
  const generateQR = useCallback(async () => {
    setIsLoading(true);
    try {
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(studentNumber, {
        width: 300,
        margin: 4,
        color: {
          // High contrast QR (best for scanners): black on white, no transparency.
          dark: "#000000",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("QR generation error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [studentNumber]);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  // Download the card as a PNG by drawing onto a canvas
  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !qrDataUrl) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 600;
    const H = 900;
    canvas.width = W;
    canvas.height = H;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = bg;
    ctx.roundRect(0, 0, W, H, 40);
    ctx.fill();

    // Decorative top glow
    const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 300);
    glow.addColorStop(0, "rgba(139,92,246,0.3)");
    glow.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 300);

    // Club name
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(clubName.toUpperCase(), W / 2, 60);

    // Belt color accent bar
    if (beltColor) {
      const accentY = 80;
      ctx.fillStyle = beltColor;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(W / 2 - 30, accentY, 60, 4);
      ctx.globalAlpha = 1;
    }

    // QR code image
    const qrImg = new window.Image();
    qrImg.src = qrDataUrl;
    await new Promise<void>((res) => { qrImg.onload = () => res(); });

    const qrSize = 300;
    const qrX = (W - qrSize) / 2;
    const qrY = 120;

    // QR background glow
    const qrGlow = ctx.createRadialGradient(W / 2, qrY + qrSize / 2, 0, W / 2, qrY + qrSize / 2, 200);
    qrGlow.addColorStop(0, "rgba(139,92,246,0.2)");
    qrGlow.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = qrGlow;
    ctx.fillRect(0, qrY - 40, W, qrSize + 80);

    // QR border box
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 24);
    ctx.stroke();

    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Student name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(studentName, W / 2, qrY + qrSize + 70);

    // Student number
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "bold 20px monospace";
    ctx.fillText(studentNumber, W / 2, qrY + qrSize + 110);

    // Belt info
    if (beltName && beltColor) {
      const beltY = qrY + qrSize + 150;
      ctx.fillStyle = beltColor + "30";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 80, beltY - 24, 160, 40, 20);
      ctx.fill();
      ctx.fillStyle = beltColor;
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillText(beltName, W / 2, beltY);
    }

    // Footer
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("بطاقة العضوية — Membership Card", W / 2, H - 40);

    // Download
    const link = document.createElement("a");
    link.download = `MAIDAN-${studentNumber}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Print
  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>بطاقة ${studentName}</title>
          <style>
            body { margin: 0; padding: 0; background: #0f172a; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .card { width: 320px; font-family: system-ui, sans-serif; }
          </style>
        </head>
        <body>
          <div class="card">${printRef.current.innerHTML}</div>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const cardContent = (
    <div className="flex flex-col items-center">
      {/* Header */}
      <div className="w-full text-center mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{clubName}</p>
        {beltColor && (
          <div className="w-12 h-1 mx-auto mt-2 rounded-full opacity-70" style={{ backgroundColor: beltColor }} />
        )}
      </div>

      {/* QR Code */}
      <div className="relative">
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-3xl blur-2xl opacity-30 scale-110"
          style={{ backgroundColor: beltColor || "#8b5cf6" }}
        />
        <div className="relative w-48 h-48 rounded-2xl border border-white/10 bg-black/20 p-3 flex items-center justify-center backdrop-blur-sm">
          {isLoading ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
          ) : (
            <QrCode className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: beltColor || "#8b5cf6" }} />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: beltColor || "#8b5cf6" }} />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg" style={{ borderColor: beltColor || "#8b5cf6" }} />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg" style={{ borderColor: beltColor || "#8b5cf6" }} />
      </div>

      {/* Student info */}
      <div className="mt-5 text-center space-y-1.5">
        <p className="font-black text-xl text-white">{studentName}</p>
        <p className="font-mono text-xs font-bold tracking-widest text-muted-foreground">{studentNumber}</p>
        {beltName && beltColor && (
          <span
            className="inline-block px-4 py-1 rounded-full text-xs font-black border mt-2"
            style={{ borderColor: beltColor + "50", color: beltColor, backgroundColor: beltColor + "15" }}
          >
            {beltName}
          </span>
        )}
      </div>

      {/* Scan hint */}
      <p className="mt-5 text-[10px] font-bold text-muted-foreground/50 text-center">
        امسح الرمز لتسجيل الحضور
      </p>
    </div>
  );

  // Inline mode (sidebar card)
  if (inline) {
    return (
      <div className="glass-card p-6 relative overflow-hidden group">
        <div
          className="absolute top-0 end-0 w-32 h-32 blur-3xl opacity-10 -me-16 -mt-16 pointer-events-none"
          style={{ backgroundColor: beltColor || "#8b5cf6" }}
        />
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70 flex items-center gap-2">
            <QrCode className="w-3.5 h-3.5" />
            بطاقة الحضور
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              title="طباعة"
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 flex items-center justify-center text-muted-foreground hover:text-primary transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDownload}
              disabled={isLoading || !qrDataUrl}
              title="تحميل"
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 flex items-center justify-center text-muted-foreground hover:text-emerald-400 transition-all disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card preview */}
        <div ref={printRef}>{cardContent}</div>

        {/* Hidden canvas for PNG generation */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // Modal mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full max-w-sm glass-card p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div ref={printRef}>{cardContent}</div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-sm font-bold text-muted-foreground hover:text-white transition-all"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
          <button
            onClick={handleDownload}
            disabled={isLoading || !qrDataUrl}
            className="flex items-center justify-center gap-2 py-3 rounded-xl gradient-brand text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-40 shadow-lg shadow-primary/20"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            تحميل PNG
          </button>
        </div>

        {/* Hidden canvas for PNG generation */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
