"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { toPng, toBlob } from "html-to-image";
import { PDFDocument } from "pdf-lib";
import {
  X,
  Printer,
  Download,
  QrCode,
  Sparkles,
  Layers,
  Check,
  FileText,
  Zap,
  Loader2,
  FileDown,
  CheckCircle2,
  AlertCircle,
  Palette,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrStandeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type StandeeStyle = "crimson" | "cyberpunk" | "minimal" | "student" | "industrial" | "pure_qr";
type StandeeFormat = "poster" | "standee";
type PrintColorMode = "color" | "bw";

export function QrStandeeModal({ isOpen, onClose }: QrStandeeModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<StandeeStyle>("crimson");
  const [selectedFormat, setSelectedFormat] = useState<StandeeFormat>("poster");
  const [colorMode, setColorMode] = useState<PrintColorMode>("color");
  const [portalUrl, setPortalUrl] = useState("https://automatic-print-system.vercel.app");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isSpooling, setIsSpooling] = useState(false);
  const [spoolMessage, setSpoolMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isExporting, setIsExporting] = useState<"png" | "pdf" | null>(null);
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
        const qrSize = 640;
        canvas.width = qrSize;
        canvas.height = qrSize;

        // Custom dark/light colors depending on style & color mode
        let darkColor = "#000000";
        let lightColor = "#FFFFFF";

        if (colorMode === "color") {
          if (selectedStyle === "cyberpunk") {
            darkColor = "#00F5FF";
            lightColor = "#0A1128";
          } else if (selectedStyle === "crimson") {
            darkColor = "#7A0019";
          } else if (selectedStyle === "student") {
            darkColor = "#FF6B35";
          } else if (selectedStyle === "minimal") {
            darkColor = "#0F172A";
          } else {
            darkColor = "#000000";
          }
        }

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
            ctx.shadowBlur = 12;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(center, center, badgeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Circular badge border matching theme
            ctx.strokeStyle = darkColor;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(center, center, badgeRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Draw Rishihood logo centered
            ctx.drawImage(logo, x + 6, y + 6, logoSize - 12, logoSize - 12);
          }
        }

        setQrDataUrl(canvas.toDataURL("image/png"));
      } catch (e) {
        console.error("QR Generation Error:", e);
      }
    };

    generateQrWithLogo();
  }, [portalUrl, selectedStyle, colorMode]);

  // 1. Direct Print via Local Print Daemon (Canon MF280 direct spool, NO dialogs)
  const handleDirectPrintDaemon = async () => {
    if (!printAreaRef.current) return;
    setIsSpooling(true);
    setSpoolMessage({
      type: "info",
      text: `Rendering ${colorMode === "bw" ? "B&W" : "Colour"} card for Canon printer...`,
    });

    try {
      const blob = await toBlob(printAreaRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      });

      if (!blob) throw new Error("Failed to render standee canvas");

      setSpoolMessage({ type: "info", text: "Sending directly to printer queue..." });

      const formData = new FormData();
      formData.append("file", blob, `ru-qr-${selectedStyle}-${selectedFormat}-${colorMode}.png`);
      formData.append("copies", "1");
      formData.append("color", colorMode === "color" ? "true" : "false");
      formData.append("layout", "portrait");
      formData.append("paperSize", "A4");
      formData.append("userName", "Direct Standee Print (Admin)");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit print job");
      }

      setSpoolMessage({
        type: "success",
        text: `Direct print sent! Canon MF280 will print in ${colorMode === "bw" ? "Black & White" : "Colour"} in ~3s.`,
      });

      setTimeout(() => setSpoolMessage(null), 5000);
    } catch (err: any) {
      console.error("Direct print failed:", err);
      setSpoolMessage({ type: "error", text: err.message || "Failed to print directly" });
      setTimeout(() => setSpoolMessage(null), 5000);
    } finally {
      setIsSpooling(false);
    }
  };

  // 2. Browser Print Dialog (Full Page A4)
  const handleBrowserPrint = () => {
    window.print();
  };

  // 3. Download High-Res PNG File
  const handleDownloadPng = async () => {
    if (!printAreaRef.current) return;
    setIsExporting("png");
    try {
      const dataUrl = await toPng(printAreaRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `rishihood-qr-${selectedStyle}-${selectedFormat}-${colorMode}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export PNG:", err);
    } finally {
      setIsExporting(null);
    }
  };

  // 4. Download High-Res A4 PDF File
  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsExporting("pdf");
    try {
      const dataUrl = await toPng(printAreaRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      });

      const pdfDoc = await PDFDocument.create();
      // Standard A4 dimensions in points (595.28 x 841.89)
      const page = pdfDoc.addPage([595.28, 841.89]);
      const pngImageBytes = await fetch(dataUrl).then((res) => res.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngImageBytes);

      if (selectedFormat === "poster") {
        if (selectedStyle === "pure_qr") {
          // Pure QR centered large on A4
          const qrDim = 460;
          page.drawImage(pngImage, {
            x: (595.28 - qrDim) / 2,
            y: (841.89 - qrDim) / 2,
            width: qrDim,
            height: qrDim,
          });
        } else {
          // Full page A4 with 20pt bleed margin
          const margin = 20;
          const targetWidth = 595.28 - margin * 2;
          const targetHeight = (pngImage.height / pngImage.width) * targetWidth;
          const y = (841.89 - targetHeight) / 2;
          page.drawImage(pngImage, {
            x: margin,
            y: y > margin ? y : margin,
            width: targetWidth,
            height: targetHeight > 841.89 - margin * 2 ? 841.89 - margin * 2 : targetHeight,
          });
        }
      } else {
        // Standee format centered on A4
        const width = selectedStyle === "pure_qr" ? 340 : 380;
        const height = (pngImage.height / pngImage.width) * width;
        page.drawImage(pngImage, {
          x: (595.28 - width) / 2,
          y: (841.89 - height) / 2,
          width: width,
          height: height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rishihood-qr-${selectedStyle}-${selectedFormat}-${colorMode}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export PDF:", err);
    } finally {
      setIsExporting(null);
    }
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
                      Print full-page posters, desk standees, or pure plain QR codes with official Rishihood logo.
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

              {/* Status Banner */}
              {spoolMessage && (
                <div
                  className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 border-b transition-all ${
                    spoolMessage.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : spoolMessage.type === "error"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      : "bg-primary/10 text-primary border-primary/20"
                  }`}
                >
                  {spoolMessage.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  {spoolMessage.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
                  {spoolMessage.type === "info" && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                  <span>{spoolMessage.text}</span>
                </div>
              )}

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Controls Column */}
                <div className="md:col-span-5 flex flex-col gap-4">
                  {/* 1. Format Switcher */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                      1. Print Format & Sizing
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedFormat("poster")}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          selectedFormat === "poster"
                            ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/40"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <FileText className="h-4 w-4 mb-1" />
                        <span>Full Page A4</span>
                        <span className="text-[10px] opacity-75 font-normal">100% Sheet (Wall/Door)</span>
                      </button>

                      <button
                        onClick={() => setSelectedFormat("standee")}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          selectedFormat === "standee"
                            ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/40"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Layers className="h-4 w-4 mb-1" />
                        <span>Desk Standee</span>
                        <span className="text-[10px] opacity-75 font-normal">4×6 Acrylic Size</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Color Mode Switcher (Colour vs B&W) */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                      2. Output Color Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setColorMode("color")}
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          colorMode === "color"
                            ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/40"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Palette className="h-4 w-4 text-amber-500" />
                        <span>Full Colour</span>
                      </button>

                      <button
                        onClick={() => setColorMode("bw")}
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          colorMode === "bw"
                            ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/40"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <CircleDot className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                        <span>Black & White</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Style Selector */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                      3. Choose Template Style
                    </label>
                    <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {[
                        {
                          id: "pure_qr" as StandeeStyle,
                          name: "Plain QR Code Only",
                          desc: "No framing, text, or borders — only QR & center logo",
                          badge: "bg-black dark:bg-white",
                        },
                        {
                          id: "crimson" as StandeeStyle,
                          name: "University Crimson & Gold",
                          desc: "Official RU colors, crest & premium gold trim",
                          badge: "bg-[#7A0019]",
                        },
                        {
                          id: "cyberpunk" as StandeeStyle,
                          name: "Cyberpunk Tech Lab",
                          desc: "Dark obsidian, neon cyan & corner matrix accents",
                          badge: "bg-cyan-400",
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
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                            selectedStyle === style.id
                              ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30"
                              : "border-border hover:bg-muted/50 text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`h-3.5 w-3.5 rounded-full shrink-0 shadow-xs ${style.badge}`} />
                            <div>
                              <p className="text-xs font-bold leading-tight">{style.name}</p>
                              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                {style.desc}
                              </p>
                            </div>
                          </div>
                          {selectedStyle === style.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 pt-1">
                    {/* Primary Direct Print to Canon MF280 */}
                    <Button
                      onClick={handleDirectPrintDaemon}
                      disabled={isSpooling}
                      className="w-full gap-2 font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground h-10"
                    >
                      {isSpooling ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Spooling to Canon MF280...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 fill-current" />
                          <span>Direct Print (Canon MF280)</span>
                        </>
                      )}
                    </Button>

                    {/* Secondary Actions */}
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        onClick={handleBrowserPrint}
                        className="gap-1.5 text-xs h-9 px-2"
                        title="Open system print dialog"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>System Print</span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleDownloadPng}
                        disabled={isExporting !== null}
                        className="gap-1.5 text-xs h-9 px-2"
                        title="Download crisp PNG"
                      >
                        {isExporting === "png" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span>PNG</span>
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleDownloadPdf}
                        disabled={isExporting !== null}
                        className="gap-1.5 text-xs h-9 px-2"
                        title="Download A4 PDF"
                      >
                        {isExporting === "pdf" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileDown className="h-3.5 w-3.5" />
                        )}
                        <span>PDF</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right Live Preview Column */}
                <div className="md:col-span-7 flex flex-col items-center justify-center bg-slate-950/20 dark:bg-black/40 rounded-2xl p-4 border border-border/50 overflow-hidden">
                  <div className="flex items-center justify-between w-full mb-3 px-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Live Preview ({selectedFormat === "poster" ? "Full Page A4" : "Desk Standee"})
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                        {colorMode === "bw" ? "B&W Mode" : "Colour Mode"}
                      </span>
                      <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                        {selectedFormat === "poster" ? "100% Page Fill" : "4\" × 6\" Cut Size"}
                      </span>
                    </div>
                  </div>

                  {/* The Printed Card Container */}
                  <div
                    ref={printAreaRef}
                    id="printable-qr-standee"
                    style={{
                      filter: colorMode === "bw" ? "grayscale(100%)" : "none",
                    }}
                    className={`transition-all duration-300 shadow-2xl overflow-hidden flex flex-col justify-between ${
                      selectedFormat === "poster"
                        ? "format-poster w-[340px] h-[480px] rounded-xl"
                        : "format-standee w-[290px] h-[420px] rounded-2xl"
                    } ${
                      selectedStyle === "pure_qr"
                        ? "style-pure_qr bg-white text-black border-0 shadow-sm items-center justify-center p-4"
                        : selectedStyle === "crimson"
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
                    {/* If Plain QR style is selected: NO headers, NO footers, NO text — pure QR only! */}
                    {selectedStyle === "pure_qr" ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-2 text-center w-full h-full">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="RU Portal QR"
                            className="qr-code-img pure-qr-img object-contain"
                            style={{
                              width: selectedFormat === "poster" ? "300px" : "240px",
                              height: selectedFormat === "poster" ? "300px" : "240px",
                            }}
                          />
                        ) : (
                          <div className="w-56 h-56 flex items-center justify-center">
                            <span className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
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
                            <p className="poster-header-brand text-[12px] font-black uppercase tracking-wider">
                              Rishihood University
                            </p>
                          </div>
                          <h4 className="poster-header-title text-sm font-extrabold uppercase tracking-tight">
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
                                className="qr-code-img w-44 h-44 object-contain rounded-xl"
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
                            className={`poster-scan-title mt-2 text-[11px] font-bold tracking-tight uppercase ${
                              selectedStyle === "cyberpunk"
                                ? "text-[#00F5FF]"
                                : selectedStyle === "crimson"
                                ? "text-[#7A0019]"
                                : "text-slate-800"
                            }`}
                          >
                            Point Camera to Scan & Print
                          </p>
                          <p className="poster-url-text text-[9.5px] opacity-75 font-mono">
                            automatic-print-system.vercel.app
                          </p>
                        </div>

                        {/* ── CARD FOOTER: 3 SIMPLE STEPS ── */}
                        <div
                          className={`poster-footer p-3 border-t text-[10px] ${
                            selectedStyle === "cyberpunk"
                              ? "bg-[#080E1E] border-[#00F5FF]/20"
                              : selectedStyle === "crimson"
                              ? "bg-[#F5EBE6] border-[#7A0019]/20"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="flex flex-col items-center">
                              <div className="step-num h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[9px] mb-0.5">
                                1
                              </div>
                              <span className="step-title font-bold leading-tight">Scan QR</span>
                              <span className="step-sub text-[8px] opacity-75">Phone Camera</span>
                            </div>

                            <div className="flex flex-col items-center">
                              <div className="step-num h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[9px] mb-0.5">
                                2
                              </div>
                              <span className="step-title font-bold leading-tight">Upload Doc</span>
                              <span className="step-sub text-[8px] opacity-75">PDF / Word</span>
                            </div>

                            <div className="flex flex-col items-center">
                              <div className="step-num h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[9px] mb-0.5">
                                3
                              </div>
                              <span className="step-title font-bold leading-tight">Collect</span>
                              <span className="step-sub text-[8px] opacity-75">Instant Print</span>
                            </div>
                          </div>

                          <div className="poster-brand-footer mt-2 text-center text-[8px] opacity-65 font-medium border-t border-black/10 dark:border-white/10 pt-1">
                            Powered by Rishihood University Direct Print System
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dedicated Clean Full-Page Print Stylesheet */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          /* Hide all page UI, headers, modals, backdrops */
          body * {
            visibility: hidden !important;
          }

          /* Make ONLY the printable standee card visible */
          #printable-qr-standee,
          #printable-qr-standee * {
            visibility: visible !important;
          }

          /* FULL-PAGE A4 POSTER LAYOUT (100% Page Fill) */
          #printable-qr-standee.format-poster {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 36px 32px !important;
            border-radius: 0 !important;
            border-width: 8px !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* PLAIN QR CODE TEMPLATE (NO FRAME, NO TEXT) */
          #printable-qr-standee.style-pure_qr {
            border: none !important;
            background: #ffffff !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: none !important;
          }

          #printable-qr-standee.format-poster.style-pure_qr .pure-qr-img {
            width: 480px !important;
            height: 480px !important;
          }

          #printable-qr-standee.format-standee.style-pure_qr .pure-qr-img {
            width: 320px !important;
            height: 320px !important;
          }

          #printable-qr-standee.format-poster .poster-header-brand {
            font-size: 16px !important;
          }

          #printable-qr-standee.format-poster .poster-header-title {
            font-size: 24px !important;
            margin-top: 6px !important;
          }

          #printable-qr-standee.format-poster .qr-code-img:not(.pure-qr-img) {
            width: 320px !important;
            height: 320px !important;
          }

          #printable-qr-standee.format-poster .poster-scan-title {
            font-size: 18px !important;
            margin-top: 14px !important;
          }

          #printable-qr-standee.format-poster .poster-url-text {
            font-size: 13px !important;
            margin-top: 4px !important;
          }

          #printable-qr-standee.format-poster .poster-footer {
            padding: 20px !important;
          }

          #printable-qr-standee.format-poster .step-num {
            height: 28px !important;
            width: 28px !important;
            font-size: 13px !important;
            margin-bottom: 6px !important;
          }

          #printable-qr-standee.format-poster .step-title {
            font-size: 14px !important;
          }

          #printable-qr-standee.format-poster .step-sub {
            font-size: 11px !important;
          }

          #printable-qr-standee.format-poster .poster-brand-footer {
            font-size: 11px !important;
            margin-top: 12px !important;
            padding-top: 8px !important;
          }

          /* COMPACT DESK STANDEE LAYOUT (4"x6" Centered on A4 with cut border) */
          #printable-qr-standee.format-standee:not(.style-pure_qr) {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 4.2in !important;
            height: 6.2in !important;
            margin: 0 !important;
            border-radius: 18px !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #printable-qr-standee.format-standee.style-pure_qr {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 4.2in !important;
            height: 6.2in !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </>
  );
}
