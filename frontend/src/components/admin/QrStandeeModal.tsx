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
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrStandeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type StandeeStyle = "pure_qr_bw" | "pure_qr" | "executive" | "editorial" | "notice" | "tech_lab";
type StandeeFormat = "poster" | "standee";
type PrintColorMode = "color" | "bw";

export function QrStandeeModal({ isOpen, onClose }: QrStandeeModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<StandeeStyle>("pure_qr_bw");
  const [selectedFormat, setSelectedFormat] = useState<StandeeFormat>("poster");
  const [colorMode, setColorMode] = useState<PrintColorMode>("color");
  const [portalUrl, setPortalUrl] = useState("https://automatic-print-system.vercel.app");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isSpooling, setIsSpooling] = useState(false);
  const [spoolMessage, setSpoolMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isExporting, setIsExporting] = useState<"png" | "pdf" | null>(null);
  const [connectedPrinterName, setConnectedPrinterName] = useState<string>("");
  const [isPrinterOnline, setIsPrinterOnline] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const isPureQr = selectedStyle === "pure_qr" || selectedStyle === "pure_qr_bw";

  // Detect connected printer dynamically and verify live connection
  useEffect(() => {
    if (!isOpen) return;
    const fetchPrinterInfo = async () => {
      try {
        const res = await fetch("/api/admin/printer-status");
        if (res.ok) {
          const data = await res.json();
          const p = data?.connectedPrinter;
          if (p && p.isConnected && p.state !== "offline") {
            setIsPrinterOnline(true);
            setConnectedPrinterName(p.name || "");
          } else {
            setIsPrinterOnline(false);
            setConnectedPrinterName("");
          }
        } else {
          setIsPrinterOnline(false);
          setConnectedPrinterName("");
        }
      } catch {
        setIsPrinterOnline(false);
        setConnectedPrinterName("");
      }
    };
    fetchPrinterInfo();
  }, [isOpen]);

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

        // QR Matrix Pattern Color:
        // If pure_qr_bw or B&W mode -> Pure Black (#000000)
        // If color mode and other templates -> Rishihood Crimson (#7A0019)
        const isPatternBlack = selectedStyle === "pure_qr_bw" || colorMode === "bw";
        const darkColor = isPatternBlack ? "#000000" : "#7A0019";
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
          // Load and draw Rishihood Logo in dead center in its FULL VIBRANT COLOURS
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

            // Circular badge border matching theme
            ctx.strokeStyle = selectedStyle === "pure_qr_bw" ? "#7A0019" : darkColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(center, center, badgeRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Draw full-colour Rishihood logo centered
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

  // 1. Direct Print via Local Print Daemon (direct spool, NO dialogs)
  const handleDirectPrintDaemon = async () => {
    if (!printAreaRef.current) return;
    setIsSpooling(true);
    const targetPrinter = connectedPrinterName || "Printer";
    setSpoolMessage({
      type: "info",
      text: `Rendering card for ${targetPrinter}...`,
    });

    try {
      const blob = await toBlob(printAreaRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      });

      if (!blob) throw new Error("Failed to render standee canvas");

      setSpoolMessage({ type: "info", text: "Sending directly to printer queue..." });

      const isColorPrint = selectedStyle === "pure_qr_bw" || colorMode === "color";

      const formData = new FormData();
      formData.append("file", blob, `ru-qr-${selectedStyle}-${selectedFormat}.png`);
      formData.append("copies", "1");
      formData.append("color", isColorPrint ? "true" : "false");
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
        type: isPrinterOnline ? "success" : "info",
        text: isPrinterOnline
          ? `Direct print sent! ${connectedPrinterName} will print in ~3s.`
          : "Spooling to print queue! (Printer is currently offline — will print once reconnected)",
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
      link.download = `rishihood-qr-${selectedStyle}-${selectedFormat}.png`;
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
        if (isPureQr) {
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
        const width = isPureQr ? 340 : 380;
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
      link.download = `rishihood-qr-${selectedStyle}-${selectedFormat}.pdf`;
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
                      Clean signage layouts with high scannability and meaningful directions.
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
                          id: "pure_qr_bw" as StandeeStyle,
                          name: "Black QR + Colour Logo",
                          desc: "Pure black QR code with vibrant full-colour RU logo in center",
                          badge: "bg-black border border-amber-400",
                        },
                        {
                          id: "pure_qr" as StandeeStyle,
                          name: "Crimson QR + Colour Logo",
                          desc: "Crimson QR code with vibrant full-colour RU logo in center",
                          badge: "bg-[#7A0019]",
                        },
                        {
                          id: "executive" as StandeeStyle,
                          name: "University Executive",
                          desc: "Crimson banner, gold trim & clear 1-2-3 action steps",
                          badge: "bg-[#7A0019]",
                        },
                        {
                          id: "editorial" as StandeeStyle,
                          name: "Modern Swiss Minimal",
                          desc: "Clean white layout with precision hairline borders",
                          badge: "bg-[#C5A059]",
                        },
                        {
                          id: "notice" as StandeeStyle,
                          name: "Campus Notice Board",
                          desc: "Bold high-contrast header with 3 clean step cards",
                          badge: "bg-[#7A0019]",
                        },
                        {
                          id: "tech_lab" as StandeeStyle,
                          name: "Innovation & Tech Lab",
                          desc: "Obsidian dark canvas with crimson & gold accents",
                          badge: "bg-[#18080E]",
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
                    {/* Primary Direct Print */}
                    <Button
                      onClick={handleDirectPrintDaemon}
                      disabled={isSpooling}
                      className="w-full gap-2 font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground h-10"
                    >
                      {isSpooling ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Spooling to Printer...</span>
                        </>
                      ) : (
                        <>
                          {isPrinterOnline ? (
                            <Zap className="h-4 w-4 fill-current text-amber-300" />
                          ) : (
                            <Printer className="h-4 w-4 opacity-80" />
                          )}
                          <span>Direct Print</span>
                          {isPrinterOnline && connectedPrinterName ? (
                            <>
                              <span className="text-[11px] font-normal opacity-85 truncate max-w-[130px]">
                                ({connectedPrinterName})
                              </span>
                              <span
                                className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 ml-0.5 inline-block"
                                title="Printer Connected & Ready"
                              />
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] font-normal text-amber-200/90 ml-0.5">
                                (Offline)
                              </span>
                              <span
                                className="h-2 w-2 rounded-full bg-amber-400 shrink-0 ml-0.5 inline-block"
                                title="Printer Disconnected / Offline"
                              />
                            </>
                          )}
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
                        {selectedStyle === "pure_qr_bw"
                          ? "Black QR + Colour Logo"
                          : colorMode === "bw"
                          ? "B&W Mode"
                          : "RU Crimson & Gold"}
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
                      filter: colorMode === "bw" && selectedStyle !== "pure_qr_bw" ? "grayscale(100%)" : "none",
                    }}
                    className={`transition-all duration-300 shadow-2xl overflow-hidden flex flex-col justify-between ${
                      selectedFormat === "poster"
                        ? "format-poster w-[340px] h-[480px] rounded-xl"
                        : "format-standee w-[290px] h-[420px] rounded-2xl"
                    } ${
                      isPureQr
                        ? "style-pure_qr bg-white text-black border-0 shadow-sm items-center justify-center p-4"
                        : selectedStyle === "executive"
                        ? "bg-[#FFFDF9] text-[#1E1E24] border-[3px] border-[#7A0019]"
                        : selectedStyle === "editorial"
                        ? "bg-white text-slate-900 border-2 border-[#7A0019]/40"
                        : selectedStyle === "notice"
                        ? "bg-[#FDFBF7] text-[#1A1A1A] border-2 border-[#7A0019]"
                        : "bg-[#12070B] text-zinc-100 border-2 border-[#7A0019] shadow-[0_0_25px_rgba(122,0,25,0.35)]"
                    }`}
                  >
                    {/* ═══════════════════════════════════════════════════════
                        PLAIN QR CODE TEMPLATES (Zero Frame, Zero Text)
                       ═══════════════════════════════════════════════════════ */}
                    {isPureQr ? (
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
                          <h4 className="poster-header-title text-base font-extrabold uppercase tracking-tight text-white">
                            Print Station
                          </h4>
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
                          <p className="poster-scan-title mt-2.5 text-[11px] font-bold tracking-tight uppercase text-[#7A0019]">
                            Scan with Phone Camera
                          </p>
                          <p className="poster-url-text text-[9px] opacity-75 font-mono text-zinc-600 mt-0.5">
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
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="step-num h-5 w-5 rounded-full bg-[#7A0019] text-[#FFFDF9] flex items-center justify-center font-bold text-[9px] mb-0.5 shadow-xs">
                                2
                              </div>
                              <span className="step-title font-bold text-zinc-900 leading-tight">Upload File</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="step-num h-5 w-5 rounded-full bg-[#7A0019] text-[#FFFDF9] flex items-center justify-center font-bold text-[9px] mb-0.5 shadow-xs">
                                3
                              </div>
                              <span className="step-title font-bold text-zinc-900 leading-tight">Collect Print</span>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : selectedStyle === "editorial" ? (
                      /* ═══════════════════════════════════════════════════════
                          TEMPLATE 2: MODERN SWISS MINIMAL (Precision Hairlines)
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
                                Rishihood University
                              </span>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#7A0019]/10 text-[#7A0019] border border-[#7A0019]/20">
                              Print Station
                            </span>
                          </div>
                          <div className="h-[2px] w-full bg-gradient-to-r from-[#7A0019] via-[#C5A059] to-transparent my-2" />
                          <h4 className="poster-header-title text-base font-black tracking-tight text-zinc-950">
                            Scan to Print
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
                          <p className="poster-url-text text-[9px] font-mono text-[#7A0019] mt-2">
                            automatic-print-system.vercel.app
                          </p>
                        </div>

                        <div className="p-3 bg-zinc-50 border-t border-zinc-200 text-[10px]">
                          <div className="flex items-center justify-between text-center px-4">
                            <span className="font-bold text-zinc-900">1. Scan</span>
                            <ArrowRight className="h-3 w-3 text-[#7A0019]" />
                            <span className="font-bold text-zinc-900">2. Upload</span>
                            <ArrowRight className="h-3 w-3 text-[#7A0019]" />
                            <span className="font-bold text-zinc-900">3. Collect</span>
                          </div>
                        </div>
                      </>
                    ) : selectedStyle === "notice" ? (
                      /* ═══════════════════════════════════════════════════════
                          TEMPLATE 3: CAMPUS NOTICE BOARD (Clear Step Cards)
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
                          <h4 className="poster-header-title text-base font-black uppercase tracking-wide">
                            Print Station
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
                            Scan to Print
                          </p>
                          <p className="poster-url-text text-[9px] opacity-75 font-mono text-zinc-600">
                            automatic-print-system.vercel.app
                          </p>
                        </div>

                        <div className="p-3 bg-[#FAF7F2] border-t border-[#7A0019]/20 text-[10px]">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white rounded-lg p-2 border border-[#7A0019]/15 text-center shadow-2xs">
                              <Smartphone className="h-4 w-4 mx-auto text-[#7A0019] mb-1" />
                              <p className="font-bold text-[9px] text-zinc-900">1. Scan</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-[#7A0019]/15 text-center shadow-2xs">
                              <Upload className="h-4 w-4 mx-auto text-[#7A0019] mb-1" />
                              <p className="font-bold text-[9px] text-zinc-900">2. Upload</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border border-[#7A0019]/15 text-center shadow-2xs">
                              <Printer className="h-4 w-4 mx-auto text-[#7A0019] mb-1" />
                              <p className="font-bold text-[9px] text-zinc-900">3. Collect</p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* ═══════════════════════════════════════════════════════
                          TEMPLATE 4: INNOVATION & TECH LAB (Obsidian Dark)
                         ═══════════════════════════════════════════════════════ */
                      <>
                        <div className="bg-gradient-to-r from-[#20050D] via-[#7A0019] to-[#20050D] text-white p-4 text-center border-b border-[#C5A059]/40">
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
                          <h4 className="poster-header-title text-base font-extrabold uppercase tracking-tight text-zinc-100 flex items-center justify-center gap-1.5">
                            <Zap className="h-4 w-4 text-[#E5C378]" />
                            Print Terminal
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
                            Scan to Print
                          </p>
                          <p className="poster-url-text text-[9px] opacity-75 font-mono text-zinc-400 mt-0.5">
                            automatic-print-system.vercel.app
                          </p>
                        </div>

                        <div className="bg-[#18070E] border-t border-[#7A0019]/40 p-3 text-[10px] text-zinc-300">
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="flex flex-col items-center">
                              <span className="step-num text-[10px] font-mono text-[#E5C378] font-bold">1. SCAN</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="step-num text-[10px] font-mono text-[#E5C378] font-bold">2. UPLOAD</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="step-num text-[10px] font-mono text-[#E5C378] font-bold">3. PRINT</span>
                            </div>
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
            padding: 40px 36px !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* PLAIN QR CODE TEMPLATES (NO FRAME, NO TEXT) */
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
            font-size: 18px !important;
          }

          #printable-qr-standee.format-poster .poster-header-title {
            font-size: 28px !important;
            margin-top: 6px !important;
          }

          #printable-qr-standee.format-poster .qr-code-img:not(.pure-qr-img) {
            width: 320px !important;
            height: 320px !important;
          }

          #printable-qr-standee.format-poster .poster-scan-title {
            font-size: 20px !important;
            margin-top: 14px !important;
          }

          #printable-qr-standee.format-poster .poster-url-text {
            font-size: 14px !important;
            margin-top: 4px !important;
          }

          #printable-qr-standee.format-poster .step-num {
            height: 32px !important;
            width: 32px !important;
            font-size: 15px !important;
            margin-bottom: 8px !important;
          }

          #printable-qr-standee.format-poster .step-title {
            font-size: 16px !important;
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
