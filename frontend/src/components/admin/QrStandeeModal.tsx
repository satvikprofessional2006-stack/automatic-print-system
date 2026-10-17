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
  Smartphone,
  Upload,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrStandeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type StandeeStyle = "executive" | "editorial" | "notice" | "tech_lab" | "pure_qr";
type StandeeFormat = "poster" | "standee";
type PrintColorMode = "color" | "bw";

export function QrStandeeModal({ isOpen, onClose }: QrStandeeModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<StandeeStyle>("executive");
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

  // Generate High-DPI QR Code with Centered Rishihood Logo (Unified Color Grading)
  useEffect(() => {
    if (!portalUrl) return;

    const generateQrWithLogo = async () => {
      try {
        const canvas = document.createElement("canvas");
        const qrSize = 640;
        canvas.width = qrSize;
        canvas.height = qrSize;

        // Unified Institutional Color Palette:
        // Color Mode: Rishihood Crimson (#7A0019) on Pure White (#FFFFFF)
        // B&W Mode: Pure Black (#000000) on Pure White (#FFFFFF)
        const darkColor = colorMode === "color" ? "#7A0019" : "#000000";
        const lightColor = "#FFFFFF";

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

            // Clean white circular backing badge with soft shadow
            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
            ctx.shadowBlur = 12;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(center, center, badgeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Circular badge border matching unified crimson / black theme
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
                        Official RU Palette
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Unified Rishihood University Crimson & Gold color grading across all design templates.
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
                        <Palette className="h-4 w-4 text-[#7A0019]" />
                        <span>RU Crimson & Gold</span>
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

                  {/* 3. Style Selector (All sharing same unified RU color grading) */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                      3. Choose Design Styling
                    </label>
                    <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {[
                        {
                          id: "executive" as StandeeStyle,
                          name: "University Executive",
                          desc: "Rich crimson banner, gold pinstripe & crest emblem",
                          badge: "bg-[#7A0019]",
                        },
                        {
                          id: "editorial" as StandeeStyle,
                          name: "Modern Swiss Editorial",
                          desc: "Clean white layout with crimson & gold hairline borders",
                          badge: "bg-[#C5A059]",
                        },
                        {
                          id: "notice" as StandeeStyle,
                          name: "Campus Notice Board",
                          desc: "Split-block header with floating step instruction cards",
                          badge: "bg-[#7A0019]",
                        },
                        {
                          id: "tech_lab" as StandeeStyle,
                          name: "Innovation & Tech Lab",
                          desc: "Dark obsidian canvas with rich crimson & gold accents",
                          badge: "bg-[#18080E]",
                        },
                        {
                          id: "pure_qr" as StandeeStyle,
                          name: "Plain QR Code Only",
                          desc: "Zero framing or text — pure QR with centered RU logo",
                          badge: "bg-black dark:bg-white",
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
                        {colorMode === "bw" ? "B&W Mode" : "RU Crimson & Gold"}
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
                        : selectedStyle === "executive"
                        ? "bg-[#FFFDF9] text-[#1E1E24] border-[3px] border-[#7A0019]"
                        : selectedStyle === "editorial"
                        ? "bg-white text-slate-900 border-2 border-[#7A0019]/40"
                        : selectedStyle === "notice"
                        ? "bg-[#FDFBF7] text-[#1A1A1A] border-2 border-[#7A0019]"
                        : "bg-[#14080E] text-zinc-100 border-2 border-[#7A0019] shadow-[0_0_25px_rgba(122,0,25,0.35)]"
                    }`}
                  >
                    {/* ═══════════════════════════════════════════════════════
                        TEMPLATE 5: PLAIN QR CODE ONLY (Zero Frame, Zero Text)
                       ═══════════════════════════════════════════════════════ */}
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
                    ) : selectedStyle === "executive" ? (
                      /* ═══════════════════════════════════════════════════════
                          TEMPLATE 1: UNIVERSITY EXECUTIVE (Official Crimson & Gold)
                         ═══════════════════════════════════════════════════════ */
                      <>
                        <div className="bg-[#7A0019] text-white p-4 text-center border-b-2 border-[#C5A059]">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <img
                              src="/Rishihood_University_idxo_lfgcw_2.png"
                              alt="RU"
                              className="h-6 w-6 object-contain"
                            />
                            <p className="poster-header-brand text-[12px] font-black uppercase tracking-wider text-[#F7E7CE]">
                              Rishihood University
                            </p>
                          </div>
                          <h4 className="poster-header-title text-sm font-extrabold uppercase tracking-tight text-white">
                            Direct Print Station
                          </h4>
                          <p className="text-[9px] uppercase tracking-widest text-[#E5C378] font-semibold mt-0.5">
                            Wireless • Cloud Powered • Instant
                          </p>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
                          <div className="relative p-3 rounded-2xl bg-white border border-[#7A0019]/25 shadow-md">
                            {qrDataUrl ? (
                              <img
                                src={qrDataUrl}
                                alt="RU Portal QR"
                                className="qr-code-img w-44 h-44 object-contain rounded-xl"
                              />
                            ) : (
                              <div className="w-44 h-44 flex items-center justify-center">
                                <span className="h-6 w-6 rounded-full border-2 border-[#7A0019] border-t-transparent animate-spin" />
                              </div>
                            )}
                          </div>
                          <p className="poster-scan-title mt-2 text-[11px] font-bold tracking-tight uppercase text-[#7A0019]">
                            Point Camera to Scan & Print
                          </p>
                          <p className="poster-url-text text-[9px] opacity-75 font-mono text-zinc-600">
                            automatic-print-system.vercel.app
                          </p>
                        </div>

                        <div className="bg-[#FAF5EE] border-t border-[#7A0019]/20 p-3 text-[10px]">
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="flex flex-col items-center">
                              <div className="step-num h-5 w-5 rounded-full bg-[#7A0019] text-[#FFFDF9] flex items-center justify-center font-bold text-[9px] mb-0.5 shadow-xs">
                                1
                              </div>
                              <span className="step-title font-bold text-zinc-900 leading-tight">Scan QR</span>
                              <span className="step-sub text-[8px] text-zinc-600">Phone Camera</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="step-num h-5 w-5 rounded-full bg-[#7A0019] text-[#FFFDF9] flex items-center justify-center font-bold text-[9px] mb-0.5 shadow-xs">
                                2
                              </div>
                              <span className="step-title font-bold text-zinc-900 leading-tight">Upload Doc</span>
                              <span className="step-sub text-[8px] text-zinc-600">PDF / Image</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="step-num h-5 w-5 rounded-full bg-[#7A0019] text-[#FFFDF9] flex items-center justify-center font-bold text-[9px] mb-0.5 shadow-xs">
                                3
                              </div>
                              <span className="step-title font-bold text-zinc-900 leading-tight">Collect</span>
                              <span className="step-sub text-[8px] text-zinc-600">Instant Output</span>
                            </div>
                          </div>
                          <div className="poster-brand-footer mt-2 text-center text-[8px] text-zinc-500 font-medium border-t border-[#7A0019]/15 pt-1">
                            Official Rishihood University Campus Direct Print Service
                          </div>
                        </div>
                      </>
                    ) : selectedStyle === "editorial" ? (
                      /* ═══════════════════════════════════════════════════════
                          TEMPLATE 2: MODERN SWISS EDITORIAL (Crimson & Gold Hairlines)
                         ═══════════════════════════════════════════════════════ */
                      <>
                        <div className="p-4 bg-white text-slate-900 border-b border-zinc-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img
                                src="/Rishihood_University_idxo_lfgcw_2.png"
                                alt="RU"
                                className="h-6 w-6 object-contain"
                              />
                              <span className="poster-header-brand text-[11px] font-black uppercase tracking-widest text-[#7A0019]">
                                Rishihood
                              </span>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#7A0019]/10 text-[#7A0019] border border-[#7A0019]/20">
                              Direct Print
                            </span>
                          </div>
                          <div className="h-[2px] w-full bg-gradient-to-r from-[#7A0019] via-[#C5A059] to-transparent my-2" />
                          <h4 className="poster-header-title text-base font-black tracking-tight text-zinc-950">
                            Scan. Upload. Print.
                          </h4>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
                          <div className="relative p-2.5 rounded-xl bg-white border-2 border-[#7A0019]/30 shadow-xs">
                            {qrDataUrl ? (
                              <img
                                src={qrDataUrl}
                                alt="RU Portal QR"
                                className="qr-code-img w-44 h-44 object-contain rounded-lg"
                              />
                            ) : (
                              <div className="w-44 h-44 flex items-center justify-center">
                                <span className="h-6 w-6 rounded-full border-2 border-[#7A0019] border-t-transparent animate-spin" />
                              </div>
                            )}
                          </div>
                          <p className="poster-scan-title mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-800">
                            Compatible with Any Phone Camera
                          </p>
                          <p className="poster-url-text text-[9px] font-mono text-[#7A0019]">
                            automatic-print-system.vercel.app
                          </p>
                        </div>

                        <div className="p-3 bg-zinc-50 border-t border-zinc-200 text-[10px]">
                          <div className="flex items-center justify-between text-center px-2">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-[#7A0019]">01</span>
                              <span className="font-medium text-zinc-800">Scan</span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-zinc-400" />
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-[#7A0019]">02</span>
                              <span className="font-medium text-zinc-800">Upload</span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-zinc-400" />
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-[#7A0019]">03</span>
                              <span className="font-medium text-zinc-800">Collect</span>
                            </div>
                          </div>
                          <div className="poster-brand-footer mt-2 text-center text-[8px] text-zinc-400 font-medium border-t border-zinc-200 pt-1">
                            RU IT Services • High-Speed Canon Direct Print
                          </div>
                        </div>
                      </>
                    ) : selectedStyle === "notice" ? (
                      /* ═══════════════════════════════════════════════════════
                          TEMPLATE 3: CAMPUS NOTICE BOARD (Card-Based Posters)
                         ═══════════════════════════════════════════════════════ */
                      <>
                        <div className="bg-[#7A0019] text-white p-3.5 text-center">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <img
                              src="/Rishihood_University_idxo_lfgcw_2.png"
                              alt="RU"
                              className="h-5 w-5 object-contain"
                            />
                            <p className="poster-header-brand text-[11px] font-black uppercase tracking-wider">
                              Rishihood University
                            </p>
                          </div>
                          <h4 className="poster-header-title text-sm font-black uppercase tracking-wide">
                            Print Station Here
                          </h4>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
                          <div className="relative p-2.5 rounded-2xl bg-white border border-[#C5A059] shadow-md">
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
                          </div>
                          <p className="poster-scan-title mt-2 text-[10px] font-black uppercase tracking-wider text-[#7A0019]">
                            Scan QR Code to Start
                          </p>
                        </div>

                        <div className="p-3 bg-[#FAF7F2] border-t border-[#7A0019]/20 text-[10px]">
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="bg-white rounded-lg p-1.5 border border-[#7A0019]/15 text-center shadow-2xs">
                              <Smartphone className="h-3.5 w-3.5 mx-auto text-[#7A0019] mb-0.5" />
                              <p className="font-bold text-[9px] text-zinc-900">1. Scan</p>
                              <p className="text-[7.5px] text-zinc-500">Camera</p>
                            </div>
                            <div className="bg-white rounded-lg p-1.5 border border-[#7A0019]/15 text-center shadow-2xs">
                              <Upload className="h-3.5 w-3.5 mx-auto text-[#7A0019] mb-0.5" />
                              <p className="font-bold text-[9px] text-zinc-900">2. Upload</p>
                              <p className="text-[7.5px] text-zinc-500">Document</p>
                            </div>
                            <div className="bg-white rounded-lg p-1.5 border border-[#7A0019]/15 text-center shadow-2xs">
                              <Printer className="h-3.5 w-3.5 mx-auto text-[#7A0019] mb-0.5" />
                              <p className="font-bold text-[9px] text-zinc-900">3. Print</p>
                              <p className="text-[7.5px] text-zinc-500">Instant</p>
                            </div>
                          </div>
                          <div className="poster-brand-footer mt-2 text-center text-[8px] text-zinc-500 font-medium">
                            Self-Service Printing for Students & Faculty
                          </div>
                        </div>
                      </>
                    ) : (
                      /* ═══════════════════════════════════════════════════════
                          TEMPLATE 4: INNOVATION & TECH LAB (Dark Crimson & Gold)
                         ═══════════════════════════════════════════════════════ */
                      <>
                        <div className="bg-gradient-to-r from-[#2B0008] via-[#7A0019] to-[#2B0008] text-white p-4 text-center border-b border-[#C5A059]/40">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <img
                              src="/Rishihood_University_idxo_lfgcw_2.png"
                              alt="RU"
                              className="h-6 w-6 object-contain"
                            />
                            <p className="poster-header-brand text-[12px] font-black uppercase tracking-wider text-[#E5C378]">
                              Rishihood University
                            </p>
                          </div>
                          <h4 className="poster-header-title text-sm font-extrabold uppercase tracking-tight text-zinc-100 flex items-center justify-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-[#E5C378]" />
                            Cloud Print Terminal
                          </h4>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
                          <div className="relative p-2.5 rounded-2xl bg-white border-2 border-[#C5A059] shadow-[0_0_20px_rgba(122,0,25,0.4)]">
                            {qrDataUrl ? (
                              <img
                                src={qrDataUrl}
                                alt="RU Portal QR"
                                className="qr-code-img w-44 h-44 object-contain rounded-xl"
                              />
                            ) : (
                              <div className="w-44 h-44 flex items-center justify-center">
                                <span className="h-6 w-6 rounded-full border-2 border-[#E5C378] border-t-transparent animate-spin" />
                              </div>
                            )}

                            {/* Corner Tech Brackets */}
                            <span className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#C5A059]" />
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#C5A059]" />
                            <span className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#C5A059]" />
                            <span className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#C5A059]" />
                          </div>

                          <p className="poster-scan-title mt-2 text-[10px] font-bold tracking-widest uppercase text-[#E5C378]">
                            Direct Spool Active • Scan Now
                          </p>
                          <p className="poster-url-text text-[9px] opacity-75 font-mono text-zinc-400">
                            automatic-print-system.vercel.app
                          </p>
                        </div>

                        <div className="bg-[#1C0810] border-t border-[#7A0019]/40 p-3 text-[10px] text-zinc-300">
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="flex flex-col items-center">
                              <span className="step-num text-[10px] font-mono text-[#E5C378] font-bold">01 // SCAN</span>
                              <span className="step-sub text-[8px] text-zinc-400">QR Code</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="step-num text-[10px] font-mono text-[#E5C378] font-bold">02 // UPLOAD</span>
                              <span className="step-sub text-[8px] text-zinc-400">Cloud Spool</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="step-num text-[10px] font-mono text-[#E5C378] font-bold">03 // PRINT</span>
                              <span className="step-sub text-[8px] text-zinc-400">Instant</span>
                            </div>
                          </div>
                          <div className="poster-brand-footer mt-2 text-center text-[8px] text-zinc-400 font-mono border-t border-[#7A0019]/30 pt-1">
                            CANON MF280 HARDWARE SPOOL • 24/7 ONLINE
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
            font-size: 26px !important;
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
