"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import {
  X,
  Printer,
  Download,
  QrCode,
  Sparkles,
  Layers,
  Check,
  Smartphone,
  Upload,
  CreditCard,
  FileText,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrStandeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type StandeeStyle = "crimson" | "cyberpunk" | "minimal" | "student" | "industrial";
type StandeeFormat = "standee" | "poster";

export function QrStandeeModal({ isOpen, onClose }: QrStandeeModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<StandeeStyle>("crimson");
  const [selectedFormat, setSelectedFormat] = useState<StandeeFormat>("standee");
  const [portalUrl, setPortalUrl] = useState("https://automatic-print-system.vercel.app");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Set real domain on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = window.location.origin.includes("localhost")
        ? "https://automatic-print-system.vercel.app"
        : window.location.origin;
      setPortalUrl(url);
    }
  }, []);

  // Generate High-DPI QR Code with Centered Rishihood Logo
  useEffect(() => {
    if (!portalUrl) return;

    const generateQrWithLogo = async () => {
      try {
        const canvas = document.createElement("canvas");
        const qrSize = 512;
        canvas.width = qrSize;
        canvas.height = qrSize;

        // Custom dark/light colors depending on style
        const darkColor =
          selectedStyle === "cyberpunk"
            ? "#00F5FF"
            : selectedStyle === "crimson"
            ? "#7A0019"
            : selectedStyle === "industrial"
            ? "#000000"
            : "#0F172A";

        const lightColor = selectedStyle === "cyberpunk" ? "#0A1128" : "#FFFFFF";

        await QRCode.toCanvas(canvas, portalUrl, {
          errorCorrectionLevel: "H", // 30% error recovery allows logo in center
          margin: 2,
          width: qrSize,
          color: {
            dark: darkColor,
            light: lightColor,
          },
        });

        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Load and draw Rishihood Logo in dead center
          const logo = new Image();
          logo.src = "/Rishihood_University_idxo_lfgcw_2.png";
          logo.crossOrigin = "anonymous";
          await new Promise<void>((resolve) => {
            logo.onload = () => resolve();
            logo.onerror = () => resolve();
          });

          if (logo.complete && logo.naturalWidth > 0) {
            const logoSize = qrSize * 0.23; // 23% of QR size (within safe 30% error threshold)
            const center = qrSize / 2;
            const x = center - logoSize / 2;
            const y = center - logoSize / 2;
            const badgeRadius = logoSize * 0.62;

            // Draw clean white circular backing badge with subtle shadow
            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
            ctx.shadowBlur = 10;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(center, center, badgeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Circular badge border matching theme
            ctx.strokeStyle = darkColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(center, center, badgeRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Draw Rishihood logo centered
            ctx.drawImage(logo, x + 4, y + 4, logoSize - 8, logoSize - 8);
          }
        }

        setQrDataUrl(canvas.toDataURL("image/png"));
      } catch (e) {
        console.error("QR Generation Error:", e);
      }
    };

    generateQrWithLogo();
  }, [portalUrl, selectedStyle]);

  // Handle Browser Direct Print
  const handlePrint = () => {
    window.print();
  };

  // Handle Download High-Res PNG
  const handleDownload = () => {
    if (!printAreaRef.current) return;
    const card = printAreaRef.current;

    // Use print element snapshot or prompt print to PDF
    window.print();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="qr-standee-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <motion.div
              key="qr-standee-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-4xl bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
              onClick={(e) => e.stopPropagation()}
            >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  QR Standee & Poster Studio
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                    Official
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select a styling theme to print standees or posters for your campus printers.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Controls Column */}
            <div className="md:col-span-5 flex flex-col gap-5">
              {/* Format Switcher */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  1. Print Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedFormat("standee")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                      selectedFormat === "standee"
                        ? "bg-primary/10 border-primary text-primary shadow-xs"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Layers className="h-4 w-4 mb-1" />
                    <span>Desk Standee</span>
                    <span className="text-[10px] opacity-75 font-normal">Acrylic Tent (4x6 / A6)</span>
                  </button>

                  <button
                    onClick={() => setSelectedFormat("poster")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                      selectedFormat === "poster"
                        ? "bg-primary/10 border-primary text-primary shadow-xs"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <FileText className="h-4 w-4 mb-1" />
                    <span>Wall Poster</span>
                    <span className="text-[10px] opacity-75 font-normal">A4 Notice Board</span>
                  </button>
                </div>
              </div>

              {/* Style Selector */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  2. Choose Visual Style
                </label>
                <div className="flex flex-col gap-2">
                  {[
                    {
                      id: "crimson" as StandeeStyle,
                      name: "University Crimson & Gold",
                      desc: "Official Rishihood University crest & colors",
                      badge: "bg-[#7A0019]",
                    },
                    {
                      id: "cyberpunk" as StandeeStyle,
                      name: "Cyberpunk Tech Lab",
                      desc: "Futuristic dark mode with neon cyan accents",
                      badge: "bg-cyan-500",
                    },
                    {
                      id: "minimal" as StandeeStyle,
                      name: "Apple Minimalist",
                      desc: "Clean monochrome typography & crisp lines",
                      badge: "bg-slate-900",
                    },
                    {
                      id: "student" as StandeeStyle,
                      name: "Vibrant Campus",
                      desc: "Friendly badges & bold step instructions",
                      badge: "bg-amber-500",
                    },
                    {
                      id: "industrial" as StandeeStyle,
                      name: "High-Contrast Industrial",
                      desc: "Extra-bold warning-bar framing for max range",
                      badge: "bg-yellow-400",
                    },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        selectedStyle === style.id
                          ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30"
                          : "border-border hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`h-4 w-4 rounded-full shrink-0 shadow-xs ${style.badge}`} />
                        <div>
                          <p className="text-xs font-bold leading-tight">{style.name}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                            {style.desc}
                          </p>
                        </div>
                      </div>
                      {selectedStyle === style.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Printing Tips Alert */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-primary flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Print Instructions:
                </p>
                <p className="text-[11px] leading-relaxed">
                  Prints on standard A4 paper. For desk standees, cut along the outer card border and insert into any clear acrylic holder.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handlePrint} className="flex-1 gap-2 font-bold shadow-md">
                  <Printer className="h-4 w-4" />
                  Print Standee Now
                </Button>
                <Button variant="outline" onClick={handleDownload} className="gap-2">
                  <Download className="h-4 w-4" />
                  PDF / PNG
                </Button>
              </div>
            </div>

            {/* Right Live Preview Column */}
            <div className="md:col-span-7 flex flex-col items-center justify-center bg-slate-950/20 dark:bg-black/40 rounded-2xl p-4 border border-border/50 overflow-hidden">
              <p className="text-[11px] font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Live Preview ({selectedFormat === "standee" ? "Desk Acrylic Card" : "A4 Wall Poster"})
              </p>

              {/* The Printed Card Container */}
              <div
                ref={printAreaRef}
                id="printable-qr-standee"
                className={`transition-all duration-300 shadow-2xl overflow-hidden flex flex-col justify-between ${
                  selectedFormat === "standee"
                    ? "w-[300px] h-[440px] rounded-2xl"
                    : "w-[320px] h-[460px] rounded-2xl"
                } ${
                  selectedStyle === "crimson"
                    ? "bg-[#FCFAF8] text-[#1E1E24] border-4 border-[#7A0019]"
                    : selectedStyle === "cyberpunk"
                    ? "bg-[#090D1A] text-[#E2E8F0] border-2 border-[#00F5FF] shadow-[0_0_30px_rgba(0,245,255,0.25)]"
                    : selectedStyle === "minimal"
                    ? "bg-white text-slate-900 border-2 border-slate-900"
                    : selectedStyle === "student"
                    ? "bg-gradient-to-b from-[#FFFDF9] to-[#FFF5E6] text-slate-900 border-4 border-[#FF6B35]"
                    : "bg-[#FAFAFA] text-black border-4 border-black"
                }`}
              >
                {/* ── CARD HEADER ── */}
                <div
                  className={`p-4 text-center border-b ${
                    selectedStyle === "crimson"
                      ? "bg-[#7A0019] text-white border-[#5A0012]"
                      : selectedStyle === "cyberpunk"
                      ? "bg-[#0A1128] text-[#00F5FF] border-[#00F5FF]/30"
                      : selectedStyle === "minimal"
                      ? "bg-white text-slate-900 border-slate-200"
                      : selectedStyle === "student"
                      ? "bg-[#FF6B35] text-white border-[#E0531E]"
                      : "bg-[#FFDE59] text-black border-black"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <img
                      src="/Rishihood_University_idxo_lfgcw_2.png"
                      alt="RU"
                      className="h-6 w-6 object-contain"
                    />
                    <p className="text-[12px] font-black uppercase tracking-wider">
                      Rishihood University
                    </p>
                  </div>
                  <h4 className="text-sm font-extrabold uppercase tracking-tight">
                    {selectedStyle === "cyberpunk"
                      ? "⚡ CLOUD PRINT TERMINAL"
                      : selectedStyle === "student"
                      ? "🚀 SCAN & PRINT IN 30 SECONDS"
                      : selectedStyle === "industrial"
                      ? "⚠️ DIRECT PRINT POINT"
                      : "Official Direct Print Station"}
                  </h4>
                </div>

                {/* ── CARD CENTER: QR CODE WITH LOGO ── */}
                <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
                  <div
                    className={`relative p-2.5 rounded-2xl shadow-lg ${
                      selectedStyle === "cyberpunk"
                        ? "bg-[#0A1128] border-2 border-[#00F5FF]/60"
                        : "bg-white border-2 border-slate-200"
                    }`}
                  >
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="RU Portal QR"
                        className="w-44 h-44 object-contain rounded-xl"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center">
                        <span className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      </div>
                    )}

                    {/* Corner Crosshair Accents for Cyberpunk */}
                    {selectedStyle === "cyberpunk" && (
                      <>
                        <span className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#00F5FF]" />
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#00F5FF]" />
                        <span className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#00F5FF]" />
                        <span className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#00F5FF]" />
                      </>
                    )}
                  </div>

                  {/* Scan Subtext */}
                  <p
                    className={`mt-2 text-[11px] font-bold tracking-tight uppercase ${
                      selectedStyle === "cyberpunk"
                        ? "text-[#00F5FF]"
                        : selectedStyle === "crimson"
                        ? "text-[#7A0019]"
                        : "text-slate-800"
                    }`}
                  >
                    Point Camera to Scan
                  </p>
                  <p className="text-[9.5px] opacity-75 font-mono">
                    automatic-print-system.vercel.app
                  </p>
                </div>

                {/* ── CARD FOOTER: 3 SIMPLE STEPS ── */}
                <div
                  className={`p-3 border-t text-[10px] ${
                    selectedStyle === "cyberpunk"
                      ? "bg-[#080E1E] border-[#00F5FF]/20"
                      : selectedStyle === "crimson"
                      ? "bg-[#F5EBE6] border-[#7A0019]/20"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="flex flex-col items-center">
                      <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[9px] mb-0.5">
                        1
                      </div>
                      <span className="font-bold leading-tight">Scan QR</span>
                      <span className="text-[8px] opacity-75">Phone Camera</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[9px] mb-0.5">
                        2
                      </div>
                      <span className="font-bold leading-tight">Upload Doc</span>
                      <span className="text-[8px] opacity-75">PDF / Word</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[9px] mb-0.5">
                        3
                      </div>
                      <span className="font-bold leading-tight">Collect</span>
                      <span className="text-[8px] opacity-75">Instant Print</span>
                    </div>
                  </div>

                  <div className="mt-2 text-center text-[8px] opacity-65 font-medium border-t border-black/10 dark:border-white/10 pt-1">
                    Powered by Rishihood University Direct Print System
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Dedicated Clean Print Stylesheet for Physical Paper / Card Printing */}
  <style jsx global>{`
    @media print {
      /* Hide all UI, headers, modals, backgrounds */
      body * {
        visibility: hidden;
      }
      /* Make ONLY the printable standee card visible */
      #printable-qr-standee,
      #printable-qr-standee * {
        visibility: visible;
      }
      #printable-qr-standee {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(1.15);
        margin: 0;
        box-shadow: none !important;
        page-break-inside: avoid;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
    }
  `}</style>
</>
);
}
