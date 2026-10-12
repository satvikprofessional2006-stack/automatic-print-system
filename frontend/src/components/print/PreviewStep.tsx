"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PrintFile,
  calcFilesAmount,
  parsePageRange,
  BW_RATE,
  COLOR_RATE,
  BW_A3_RATE,
  COLOR_A3_RATE,
} from "@/lib/printStore";
import { renderPdfPageToDataUrl } from "@/lib/pdfRenderer";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  FileText,
  FileImage,
  File as FileIcon,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Maximize2,
  X,
  Layers,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  files: PrintFile[];
  onUpdateFiles: (files: PrintFile[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export function PreviewStep({ files, onUpdateFiles, onBack, onNext }: Props) {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [activePageNum, setActivePageNum] = useState(1);
  const [pageJumpInput, setPageJumpInput] = useState("");
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const [singlePageUrls, setSinglePageUrls] = useState<Record<string, string>>({});
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [previewScope, setPreviewScope] = useState<"selected" | "all">("selected");

  const loadedPdfDocRef = useRef<{ fileIndex: number; doc: any } | null>(null);
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());
  const cachedPagesMapRef = useRef<Map<string, string>>(new Map());
  const failedPagesRef = useRef<Set<string>>(new Set());
  const extractionQueueRef = useRef<Promise<void>>(Promise.resolve());

  const currentFile = files[activeFileIndex] || files[0];
  const currentSettings = currentFile?.settings || {
    color: false,
    copies: 1,
    layout: "portrait",
    pages: 1,
    doubleSided: false,
    paperSize: "A4",
    pageRange: "all",
    pageMode: "all",
  };

  const docPages = Math.max(1, currentSettings.pages || 1);
  const isLandscape = currentSettings.layout === "landscape";
  const isColor = currentSettings.color || false;
  const paperSize = currentSettings.paperSize || "A4";
  const isA3 = paperSize === "A3";
  const isImage = currentFile?.type?.startsWith("image/");
  const isPdf = currentFile?.type === "application/pdf";

  const currentMode: "all" | "odd" | "even" | "custom" =
    currentSettings.pageMode ||
    (currentSettings.pageRange === "odd"
      ? "odd"
      : currentSettings.pageRange === "even"
      ? "even"
      : currentSettings.pageRange && currentSettings.pageRange !== "all"
      ? "custom"
      : "all");

  const currentRange =
    currentSettings.pageRange !== undefined
      ? currentSettings.pageRange
      : currentMode === "all"
      ? "all"
      : "";

  // Parse page range
  const parsedRange = useMemo(() => {
    return parsePageRange(currentRange, docPages, currentMode);
  }, [currentRange, docPages, currentMode]);

  const { totalPages, totalAmount, bwPages, colorPages, bwA3Pages, colorA3Pages } = useMemo(() => calcFilesAmount(files), [files]);

  const hasInvalidRange = useMemo(() => {
    return files.some((f) => {
      const fDocPages = Math.max(1, f.settings?.pages || 1);
      return !parsePageRange(f.settings?.pageRange, fDocPages, f.settings?.pageMode).valid;
    });
  }, [files]);

  // Reset active page number when switching files
  useEffect(() => {
    setActivePageNum(1);
  }, [activeFileIndex]);

  // Auto-jump to first selected page when range changes or if active page is not in selected range
  useEffect(() => {
    if (parsedRange.valid && parsedRange.pages.length > 0 && parsedRange.count < docPages) {
      if (!parsedRange.pages.includes(activePageNum)) {
        setActivePageNum(parsedRange.pages[0]);
      }
    }
  }, [parsedRange.pages, parsedRange.valid, parsedRange.count, docPages]);

  // When mode changes away from "all", default previewScope to "selected"
  useEffect(() => {
    if (currentMode !== "all") {
      setPreviewScope("selected");
    }
  }, [currentMode]);

  const isFiltered =
    previewScope === "selected" &&
    parsedRange.valid &&
    parsedRange.pages.length > 0 &&
    parsedRange.count < docPages;

  const navigablePages = useMemo(() => {
    if (isFiltered) {
      return parsedRange.pages;
    }
    return Array.from({ length: docPages }, (_, i) => i + 1);
  }, [isFiltered, parsedRange.pages, docPages]);

  const currentIndex = Math.max(0, navigablePages.indexOf(activePageNum));

  // Stable key based on files identity (not settings)
  const filesIdentity = useMemo(() => {
    return files.map((f) => `${f.name}-${f.size}`).join(",");
  }, [files]);

  // Generate object URLs for file previews once per file
  useEffect(() => {
    const urls: Record<number, string> = {};
    files.forEach((f, idx) => {
      try {
        const u = URL.createObjectURL(f.file);
        urls[idx] = u;
        createdBlobUrlsRef.current.add(u);
      } catch (e) {
        console.error("Error creating preview URL for", f.name, e);
      }
    });
    setPreviewUrls(urls);
  }, [filesIdentity]);

  // Clean up all created blob URLs ONLY on unmount (never prematurely mid-session!)
  useEffect(() => {
    return () => {
      createdBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      });
      createdBlobUrlsRef.current.clear();
      cachedPagesMapRef.current.clear();
    };
  }, []);

  // On-demand single-page PDF extractor with sequential queueing and persistent caching
  useEffect(() => {
    if (!isPdf || !currentFile) return;

    let cancelled = false;
    const currentKey = `${activeFileIndex}_${activePageNum}`;

    const extractSinglePage = async (pageNum: number) => {
      const pageKey = `${activeFileIndex}_${pageNum}`;
      if (cachedPagesMapRef.current.has(pageKey)) return;

      extractionQueueRef.current = extractionQueueRef.current
        .then(async () => {
          if (cancelled || cachedPagesMapRef.current.has(pageKey)) return;

          try {
            // High-fidelity Canvas rendering via PDF.js
            const rendered = await renderPdfPageToDataUrl(currentFile.file, pageNum, 1.6);
            if (rendered && rendered.dataUrl) {
              cachedPagesMapRef.current.set(pageKey, rendered.dataUrl);
              if (!cancelled) {
                setSinglePageUrls((prev) => ({ ...prev, [pageKey]: rendered.dataUrl }));
              }
              return;
            }

            // Fallback: pdf-lib single page slice
            const { PDFDocument } = await import("pdf-lib");
            let sourceDoc =
              loadedPdfDocRef.current?.fileIndex === activeFileIndex
                ? loadedPdfDocRef.current.doc
                : null;

            if (!sourceDoc) {
              const buffer = await currentFile.file.arrayBuffer();
              sourceDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
              loadedPdfDocRef.current = { fileIndex: activeFileIndex, doc: sourceDoc };
            }

            const total = sourceDoc.getPageCount();
            if (pageNum < 1 || pageNum > total) return;
            const pageIdx = pageNum - 1;

            const singleDoc = await PDFDocument.create();
            const [copiedPage] = await singleDoc.copyPages(sourceDoc, [pageIdx]);
            singleDoc.addPage(copiedPage);

            const pdfBytes = await singleDoc.save();
            const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            createdBlobUrlsRef.current.add(url);
            cachedPagesMapRef.current.set(pageKey, url);

            if (!cancelled) {
              setSinglePageUrls((prev) => ({ ...prev, [pageKey]: url }));
            }
          } catch (err) {
            console.error(`Page ${pageNum} extraction error:`, err);
          }
        })
        .catch((err) => {
          console.error("Queue extraction error:", err);
        });

      await extractionQueueRef.current;
    };

    if (!cachedPagesMapRef.current.has(currentKey)) {
      setIsPageLoading(true);
      extractSinglePage(activePageNum).finally(() => {
        if (!cancelled) setIsPageLoading(false);
      });
    } else {
      setIsPageLoading(false);
    }

    // Prefetch adjacent pages gently
    if (activePageNum < docPages && !cachedPagesMapRef.current.has(`${activeFileIndex}_${activePageNum + 1}`)) {
      extractSinglePage(activePageNum + 1);
    }
    if (activePageNum > 1 && !cachedPagesMapRef.current.has(`${activeFileIndex}_${activePageNum - 1}`)) {
      extractSinglePage(activePageNum - 1);
    }

    return () => {
      cancelled = true;
    };
  }, [isPdf, currentFile, activeFileIndex, activePageNum, docPages]);

  const activeSingleUrl = isPdf
    ? singlePageUrls[`${activeFileIndex}_${activePageNum}`] ||
      cachedPagesMapRef.current.get(`${activeFileIndex}_${activePageNum}`) ||
      null
    : null;

  const setOrientation = (layout: "portrait" | "landscape") => {
    const newFiles = [...files];
    const prevSettings = newFiles[activeFileIndex].settings || {
      color: false,
      copies: 1,
      layout: "portrait",
      pages: 1,
      doubleSided: false,
    };
    newFiles[activeFileIndex].settings = {
      ...prevSettings,
      layout,
    };
    onUpdateFiles(newFiles);
  };

  const toggleColorMode = () => {
    const newFiles = [...files];
    const prevSettings = newFiles[activeFileIndex].settings || {
      color: false,
      copies: 1,
      layout: "portrait",
      pages: 1,
      doubleSided: false,
    };
    newFiles[activeFileIndex].settings = {
      ...prevSettings,
      color: !prevSettings.color,
    };
    onUpdateFiles(newFiles);
  };

  const handlePageModeChange = (mode: "all" | "odd" | "even" | "custom") => {
    const newFiles = [...files];
    const prevSettings = newFiles[activeFileIndex].settings || {
      color: false,
      copies: 1,
      layout: "portrait",
      pages: 1,
      doubleSided: false,
    };

    let newRange = "all";
    if (mode === "odd") newRange = "odd";
    else if (mode === "even") newRange = "even";
    else if (mode === "custom") {
      const existing = prevSettings.pageRange;
      if (existing && existing !== "all" && existing !== "odd" && existing !== "even") {
        newRange = existing;
      } else {
        newRange = `1-${Math.min(docPages, 5)}`;
      }
    }

    const parsed = parsePageRange(newRange, docPages, mode);
    newFiles[activeFileIndex].settings = {
      ...prevSettings,
      pageMode: mode,
      pageRange: newRange,
      selectedPagesCount: parsed.valid ? parsed.count : docPages,
    };
    onUpdateFiles(newFiles);
  };

  const handleCustomRangeInput = (val: string) => {
    const newFiles = [...files];
    const prevSettings = newFiles[activeFileIndex].settings || {
      color: false,
      copies: 1,
      layout: "portrait",
      pages: 1,
      doubleSided: false,
    };
    const parsed = parsePageRange(val, docPages, "custom");
    newFiles[activeFileIndex].settings = {
      ...prevSettings,
      pageMode: "custom",
      pageRange: val,
      selectedPagesCount: parsed.valid ? parsed.count : docPages,
    };
    onUpdateFiles(newFiles);
  };

  const applyToAllOrientation = (layout: "portrait" | "landscape") => {
    const newFiles = files.map((f) => ({
      ...f,
      settings: {
        ...(f.settings || {
          color: false,
          copies: 1,
          layout: "portrait",
          pages: 1,
          doubleSided: false,
          paperSize: "A4",
        }),
        layout,
      },
    }));
    onUpdateFiles(newFiles);
  };

  const setPaperSize = (paperSize: "A4" | "A3") => {
    const newFiles = [...files];
    const prevSettings = newFiles[activeFileIndex].settings || {
      color: false,
      copies: 1,
      layout: "portrait",
      pages: 1,
      doubleSided: false,
      paperSize: "A4",
    };
    newFiles[activeFileIndex].settings = {
      ...prevSettings,
      paperSize,
    };
    onUpdateFiles(newFiles);
  };

  const applyToAllPaperSize = (paperSize: "A4" | "A3") => {
    const newFiles = files.map((f) => ({
      ...f,
      settings: {
        ...(f.settings || {
          color: false,
          copies: 1,
          layout: "portrait",
          pages: 1,
          doubleSided: false,
          paperSize: "A4",
        }),
        paperSize,
      },
    }));
    onUpdateFiles(newFiles);
  };

  const currentUrl = previewUrls[activeFileIndex];

  // Check if current viewed page is included in the print job
  const isCurrentPageIncluded = parsedRange.valid && parsedRange.pages.includes(activePageNum);

  const canGoNext = currentIndex < navigablePages.length - 1;
  const canGoPrev = currentIndex > 0;

  const handleNextPage = () => {
    if (currentIndex < navigablePages.length - 1) {
      setActivePageNum(navigablePages[currentIndex + 1]);
    }
  };

  const handlePrevPage = () => {
    if (currentIndex > 0) {
      setActivePageNum(navigablePages[currentIndex - 1]);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Section Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-1 text-primary">
          <Eye className="h-5 w-5" />
          <h2 className="text-xl font-bold text-foreground">Document Preview</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Inspect your document sheet, choose custom pages to print, and select orientation.
        </p>
      </div>

      {/* ── Multi-file Compact Switcher Bar (if more than 1 file) ── */}
      {files.length > 1 && (
        <div className="flex items-center justify-between gap-2 p-1.5 bg-muted/60 dark:bg-muted/30 rounded-2xl border border-border/60 shadow-2xs">
          {/* Previous File Button */}
          <button
            type="button"
            disabled={activeFileIndex === 0}
            onClick={() => setActiveFileIndex(activeFileIndex - 1)}
            className="p-2 rounded-xl hover:bg-background text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
            title="Previous file"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Center: Interactive Dropdown / Pill with full details */}
          <div className="relative flex-1 min-w-0 flex items-center justify-center">
            <select
              value={activeFileIndex}
              onChange={(e) => setActiveFileIndex(parseInt(e.target.value, 10))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label="Select file to preview"
            >
              {files.map((f, idx) => {
                const fSize = f.settings?.paperSize || "A4";
                const fDocPages = f.settings?.pages || 1;
                return (
                  <option key={f.name + idx} value={idx}>
                    File {idx + 1} of {files.length}: {f.name} ({fSize}, {fDocPages} pgs)
                  </option>
                );
              })}
            </select>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/80 border border-border/50 text-xs font-semibold text-foreground truncate max-w-full pointer-events-none shadow-2xs">
              <span className="font-bold text-primary shrink-0">
                {activeFileIndex + 1}/{files.length}
              </span>
              <span className="truncate" title={currentFile?.name}>
                {currentFile?.name}
              </span>
              <span className="text-[10px] uppercase px-1.5 py-0.2 rounded font-mono bg-muted text-muted-foreground shrink-0">
                {currentSettings.paperSize || "A4"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-70" />
            </div>
          </div>

          {/* Next File Button */}
          <button
            type="button"
            disabled={activeFileIndex === files.length - 1}
            onClick={() => setActiveFileIndex(activeFileIndex + 1)}
            className="p-2 rounded-xl hover:bg-background text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
            title="Next file"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Current File Info Strip with Interactive Segmented Color Switcher ── */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-card/70 border border-border/60 text-xs shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-primary/10 text-primary shrink-0">
            {isImage ? (
              <FileImage className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-foreground truncate max-w-[150px] sm:max-w-xs" title={currentFile?.name}>
              {currentFile?.name}
            </p>
            <p className="text-muted-foreground text-[10.5px] font-mono">
              {parsedRange.count} of {docPages} page{docPages !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Clean Segmented Color / B&W Toggle */}
        <div className="inline-flex items-center p-0.5 rounded-xl bg-muted/70 dark:bg-muted/40 border border-border/70 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (isColor) toggleColorMode();
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              !isColor
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Switch to Black & White print"
          >
            <span>B&amp;W</span>
            <span className="text-[10px] font-mono opacity-60 font-normal">₹{isA3 ? BW_A3_RATE : BW_RATE}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isColor) toggleColorMode();
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              isColor
                ? "bg-rose-500 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Switch to Colour print"
          >
            <span>Colour</span>
            <span className={cn("text-[10px] font-mono font-normal", isColor ? "text-white/85" : "opacity-60")}>
              ₹{isA3 ? COLOR_A3_RATE : COLOR_RATE}
            </span>
          </button>
        </div>
      </div>

      {/* ── Live Sheet Canvas Preview ── */}
      <div className="relative flex flex-col items-center justify-center p-4 sm:p-7 rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/60 overflow-hidden min-h-[360px] select-none">
        {/* Ambient Grid Background */}
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />



        {/* Floating Page Navigation Buttons beside the Sheet */}
        {navigablePages.length > 1 && (
          <>
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={handlePrevPage}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-background/90 hover:bg-background text-foreground shadow-lg backdrop-blur border border-border/70 disabled:opacity-0 disabled:pointer-events-none transition-all hover:scale-110 active:scale-95 cursor-pointer"
              title={isFiltered ? "Previous selected page" : "Previous page"}
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={handleNextPage}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-background/90 hover:bg-background text-foreground shadow-lg backdrop-blur border border-border/70 disabled:opacity-0 disabled:pointer-events-none transition-all hover:scale-110 active:scale-95 cursor-pointer"
              title={isFiltered ? "Next selected page" : "Next page"}
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </>
        )}

        {/* Top-Right Zoom / Inspect Button */}
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-1 rounded-lg bg-background/80 hover:bg-background text-foreground/80 hover:text-foreground text-[10px] font-medium shadow-xs backdrop-blur border border-border/60 transition-all cursor-pointer"
          title="Zoom document preview"
        >
          <Maximize2 className="h-3 w-3" />
          <span>Zoom</span>
        </button>

        {/* Top-Left Page Inclusion Banner */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-80px)]">
          {docPages > 1 && (
            isCurrentPageIncluded ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] border border-emerald-500/20 backdrop-blur shadow-2xs">
                <Check className="h-3 w-3" /> Page {activePageNum} included
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold text-[10px] border border-amber-500/30 backdrop-blur shadow-2xs">
                ✕ Page {activePageNum} skipped
              </span>
            )
          )}
        </div>

        {/* Paper Sheet Mockup with Framer Motion Layout Animation */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className={cn(
            "relative bg-white text-zinc-900 rounded-lg shadow-2xl shadow-black/25 ring-1 ring-black/10 overflow-hidden flex flex-col justify-between transition-all select-none",
            isLandscape
              ? "w-[290px] sm:w-[370px] h-[205px] sm:h-[262px]" // A4 Landscape ratio ~ 1.414:1
              : "w-[210px] sm:w-[250px] h-[297px] sm:h-[353px]" // A4 Portrait ratio ~ 1:1.414
          )}
        >
          {/* Printable Area Safe Margin Outline (faint dashed border) */}
          <div className="absolute inset-1.5 sm:inset-2 border border-dashed border-zinc-300 pointer-events-none rounded-xs z-10" />

          {/* Paper Size Indicator Badge (top right of sheet) */}
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/75 backdrop-blur-md text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow-xs pointer-events-none">
            <span>{paperSize}</span>
            <span className="opacity-70 text-[8px]">{isA3 ? "297×420mm" : "210×297mm"}</span>
          </div>

          {/* Excluded Page Watermark Overlay */}
          {docPages > 1 && !isCurrentPageIncluded && (
            <div className="absolute inset-0 bg-white/75 dark:bg-black/60 z-15 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 text-center pointer-events-none">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                Page {activePageNum} Excluded
              </span>
              <p className="text-[10px] text-zinc-500 mt-1">This page will not be printed.</p>
            </div>
          )}

          {/* Paper Content Preview with Grayscale simulation for B&W */}
          <div
            className={cn(
              "relative w-full h-full flex items-center justify-center overflow-hidden bg-white p-2 sm:p-2.5 transition-all duration-300",
              !isColor && "grayscale contrast-[1.06] brightness-[0.98]"
            )}
          >
            {isImage && currentUrl ? (
              <img
                src={currentUrl}
                alt="Document Preview"
                className="max-w-full max-h-full object-contain rounded transition-all duration-300"
              />
            ) : isPdf ? (
              activeSingleUrl ? (
                activeSingleUrl.startsWith("data:image/") ? (
                  <img
                    key={`single-pdf-img-${activeFileIndex}-${activePageNum}`}
                    src={activeSingleUrl}
                    alt={`Page ${activePageNum} Preview`}
                    className="max-w-full max-h-full object-contain rounded shadow-xs select-none pointer-events-none transition-all duration-300"
                  />
                ) : (
                  <iframe
                    key={`single-pdf-${activeFileIndex}-${activePageNum}`}
                    src={`${activeSingleUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                    title={`Page ${activePageNum} Preview`}
                    className="w-full h-full border-none pointer-events-none rounded bg-white"
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Rendering page {activePageNum}...
                  </p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                <div className="p-3 rounded-full bg-primary/10">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <p className="text-xs font-semibold text-zinc-800 line-clamp-2">
                  {currentFile?.name}
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Page {activePageNum} of {docPages}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Multi-page stepper with scope toggle, direct jump and scrub slider */}
        {docPages > 1 && (
          <div className="flex flex-col items-center gap-2 mt-3 z-10 w-full max-w-xs sm:max-w-sm px-2">
            {/* Scope Toggle Pill (when custom or odd/even is active) */}
            {parsedRange.valid && parsedRange.count < docPages && (
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-background/90 border border-border/70 text-[11px] shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewScope("selected");
                    if (!parsedRange.pages.includes(activePageNum)) {
                      setActivePageNum(parsedRange.pages[0]);
                    }
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1",
                    previewScope === "selected"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Check className="h-3 w-3" />
                  <span>Selected ({parsedRange.count})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewScope("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1",
                    previewScope === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>All ({docPages})</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between w-full bg-background/85 backdrop-blur px-3 py-1.5 rounded-full border border-border/60 text-xs shadow-2xs">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={handlePrevPage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/70 hover:bg-muted text-foreground/80 hover:text-foreground disabled:opacity-25 disabled:pointer-events-none transition-colors font-medium text-[11px] cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>

              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground">
                <span>Page</span>
                <input
                  type="number"
                  min={1}
                  max={docPages}
                  value={pageJumpInput !== "" ? pageJumpInput : activePageNum}
                  onFocus={() => setPageJumpInput(String(activePageNum))}
                  onChange={(e) => setPageJumpInput(e.target.value)}
                  onBlur={() => {
                    const num = parseInt(pageJumpInput, 10);
                    if (!isNaN(num)) {
                      setActivePageNum(Math.max(1, Math.min(docPages, num)));
                    }
                    setPageJumpInput("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const num = parseInt(pageJumpInput, 10);
                      if (!isNaN(num)) {
                        setActivePageNum(Math.max(1, Math.min(docPages, num)));
                      }
                      setPageJumpInput("");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-12 h-6 px-1 text-center font-bold font-mono text-xs rounded bg-muted/60 border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary"
                  title="Type page number and press Enter"
                />
                <span className="text-muted-foreground font-normal">
                  {isFiltered ? `(${currentIndex + 1} of ${navigablePages.length})` : `of ${docPages}`}
                </span>
              </div>

              <button
                type="button"
                disabled={!canGoNext}
                onClick={handleNextPage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/70 hover:bg-muted text-foreground/80 hover:text-foreground disabled:opacity-25 disabled:pointer-events-none transition-colors font-medium text-[11px] cursor-pointer"
                title="Next page"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scrub Slider for fast navigation */}
            {navigablePages.length > 2 && (
              <div className="flex items-center gap-2 w-full px-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {navigablePages[0]}
                </span>
                <input
                  type="range"
                  min={0}
                  max={navigablePages.length - 1}
                  value={currentIndex}
                  onChange={(e) => setActivePageNum(navigablePages[Number(e.target.value)])}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  title={`Jump to page ${activePageNum}`}
                />
                <span className="text-[10px] text-muted-foreground font-mono">
                  {navigablePages[navigablePages.length - 1]}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Carousel Dots & Active Status */}
        <div className="flex flex-col items-center gap-1 mt-2.5 z-10">
          {files.length > 1 && (
            <div className="flex items-center gap-1.5 mb-0.5">
              {files.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveFileIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === activeFileIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground"
                  )}
                  title={`View file ${i + 1}`}
                />
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <span>Paper:</span>
            <strong className="text-foreground uppercase">{paperSize}</strong>
            <span>•</span>
            <span>Orientation:</span>
            <strong className="text-foreground capitalize">{currentSettings.layout || "portrait"}</strong>
            <span>•</span>
            <span>Printing:</span>
            <strong className="text-foreground">
              {parsedRange.count} page{parsedRange.count !== 1 ? "s" : ""}
            </strong>
          </p>
        </div>
      </div>

      {/* ── Visible Page Selection Controls (All / Odd / Even / Custom) ── */}
      {docPages > 1 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-card/85 border border-border/70 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                Pages to Print
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                ({docPages} total)
              </span>
            </div>

            {/* Direct, Visible Segmented Buttons (No hidden dropdown on mobile) */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-muted/70 dark:bg-muted/40 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => handlePageModeChange("all")}
                className={cn(
                  "py-1.5 px-2 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer",
                  currentMode === "all"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => handlePageModeChange("odd")}
                className={cn(
                  "py-1.5 px-2 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer",
                  currentMode === "odd"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                Odd
              </button>
              <button
                type="button"
                onClick={() => handlePageModeChange("even")}
                className={cn(
                  "py-1.5 px-2 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer",
                  currentMode === "even"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                Even
              </button>
              <button
                type="button"
                onClick={() => handlePageModeChange("custom")}
                className={cn(
                  "py-1.5 px-2 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer flex items-center justify-center gap-1",
                  currentMode === "custom"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                <span>Custom</span>
              </button>
            </div>
          </div>

          {/* Customised Range Input (appears immediately when "Custom" is selected) */}
          {currentMode === "custom" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 pt-2 border-t border-border/40"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground/80">
                    Custom Page Range:
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    e.g. 1-5, 8, 11-13
                  </span>
                </div>
                <input
                  type="text"
                  value={
                    currentRange === "all" || currentRange === "odd" || currentRange === "even"
                      ? ""
                      : currentRange
                  }
                  onChange={(e) => handleCustomRangeInput(e.target.value)}
                  placeholder="e.g. 1-5, 8, 11-13"
                  autoFocus
                  className={cn(
                    "w-full h-10 px-3.5 rounded-xl bg-background border text-xs sm:text-sm font-mono transition-colors focus:outline-none focus:ring-2",
                    parsedRange.valid
                      ? "border-border/80 focus:ring-primary/40"
                      : "border-destructive text-destructive focus:ring-destructive/40"
                  )}
                />
              </div>

              {/* Validation status and savings */}
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] px-0.5">
                {parsedRange.valid ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> {parsedRange.count} of {docPages} page{parsedRange.count !== 1 ? "s" : ""} selected
                    {parsedRange.count < docPages && (
                      <span className="text-muted-foreground font-normal ml-1">
                        (Saves ₹{(docPages - parsedRange.count) * (isColor ? COLOR_RATE : BW_RATE)})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {parsedRange.error || "Please enter page numbers (e.g. 1-5, 8)"}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ── Paper Sheet Size Selector (A4 vs A3) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground/80 block">
            Paper Sheet Size *
          </label>
          <span className="text-[11px] text-muted-foreground font-mono">
            {isA3 ? "A3: ₹5 B&W / ₹20 Colour" : "A4: ₹2 B&W / ₹10 Colour"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-muted/60 dark:bg-muted/30 rounded-2xl border border-border/50">
          {/* A4 Button */}
          <button
            type="button"
            onClick={() => setPaperSize("A4")}
            className={cn(
              "flex items-center justify-center py-2.5 px-3 rounded-xl font-bold text-xs transition-all border cursor-pointer",
              !isA3
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <div className="flex flex-col text-center sm:text-left">
              <span className="text-xs font-bold">A4 Standard</span>
              <span className="text-[10px] font-normal opacity-80 font-mono">210 × 297 mm</span>
            </div>
          </button>

          {/* A3 Button */}
          <button
            type="button"
            onClick={() => setPaperSize("A3")}
            className={cn(
              "flex items-center justify-center py-2.5 px-3 rounded-xl font-bold text-xs transition-all border cursor-pointer",
              isA3
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <div className="flex flex-col text-center sm:text-left">
              <span className="text-xs font-bold">A3 Large Sheet</span>
              <span className="text-[10px] font-normal opacity-80 font-mono">297 × 420 mm</span>
            </div>
          </button>
        </div>

        {/* Multi-file batch paper size button */}
        {files.length > 1 && (
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => applyToAllPaperSize(paperSize)}
              className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
            >
              Apply {paperSize} size to all {files.length} files
            </button>
          </div>
        )}
      </div>

      {/* ── Visual Orientation Selector (Interactive Miniature Paper Sheets) ── */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground/80 block">
          Select Page Orientation *
        </label>

        <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-muted/60 dark:bg-muted/30 rounded-2xl border border-border/50">
          {/* Portrait Button with Mini Vertical A4 Sheet */}
          <button
            type="button"
            onClick={() => setOrientation("portrait")}
            className={cn(
              "flex items-center gap-3 py-2.5 px-3 rounded-xl font-semibold text-xs transition-all border",
              !isLandscape
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {/* Visual Mini Portrait Sheet */}
            <div
              className={cn(
                "w-6 h-8 rounded-[4px] border-2 flex flex-col justify-center items-center gap-[2.5px] p-1 shrink-0 transition-all",
                !isLandscape
                  ? "border-primary-foreground bg-primary-foreground/20 shadow-xs"
                  : "border-muted-foreground/50 bg-background/60"
              )}
            >
              <div className={cn("w-3 h-[1.5px] rounded-full", !isLandscape ? "bg-primary-foreground" : "bg-muted-foreground/60")} />
              <div className={cn("w-3.5 h-[1.5px] rounded-full", !isLandscape ? "bg-primary-foreground" : "bg-muted-foreground/60")} />
              <div className={cn("w-2.5 h-[1.5px] rounded-full", !isLandscape ? "bg-primary-foreground" : "bg-muted-foreground/60")} />
            </div>

            <div className="flex flex-col text-left">
              <span className="text-sm font-bold">Portrait</span>
              <span className="text-[10px] font-normal opacity-80">Upright • Vertical</span>
            </div>
          </button>

          {/* Landscape Button with Mini Horizontal A4 Sheet */}
          <button
            type="button"
            onClick={() => setOrientation("landscape")}
            className={cn(
              "flex items-center gap-3 py-2.5 px-3 rounded-xl font-semibold text-xs transition-all border",
              isLandscape
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {/* Visual Mini Landscape Sheet */}
            <div
              className={cn(
                "w-8 h-6 rounded-[4px] border-2 flex flex-col justify-center items-center gap-[2.5px] p-1 shrink-0 transition-all",
                isLandscape
                  ? "border-primary-foreground bg-primary-foreground/20 shadow-xs"
                  : "border-muted-foreground/50 bg-background/60"
              )}
            >
              <div className={cn("w-4.5 h-[1.5px] rounded-full", isLandscape ? "bg-primary-foreground" : "bg-muted-foreground/60")} />
              <div className={cn("w-4 h-[1.5px] rounded-full", isLandscape ? "bg-primary-foreground" : "bg-muted-foreground/60")} />
              <div className={cn("w-3 h-[1.5px] rounded-full", isLandscape ? "bg-primary-foreground" : "bg-muted-foreground/60")} />
            </div>

            <div className="flex flex-col text-left">
              <span className="text-sm font-bold">Landscape</span>
              <span className="text-[10px] font-normal opacity-80">Rotated • Horizontal</span>
            </div>
          </button>
        </div>

        {/* Multi-file batch orientation button */}
        {files.length > 1 && (
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => applyToAllOrientation(currentSettings.layout === "landscape" ? "landscape" : "portrait")}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              Apply {currentSettings.layout === "landscape" ? "Landscape" : "Portrait"} to all {files.length} files
            </button>
          </div>
        )}
      </div>

      {/* ── Total Cost Banner ── */}
      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground/80">
            Total to Print: <span className="font-bold text-foreground">{totalPages} page{totalPages !== 1 ? "s" : ""}</span> across {files.length} file{files.length !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
            {bwPages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/80 text-foreground/90 font-medium border border-border/60">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{bwPages} A4 B&amp;W</span>
              </span>
            )}
            {colorPages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{colorPages} A4 Colour</span>
              </span>
            )}
            {bwA3Pages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>{bwA3Pages} A3 B&amp;W</span>
              </span>
            )}
            {colorA3Pages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium border border-purple-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                <span>{colorA3Pages} A3 Colour</span>
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-foreground/80">Total Due</p>
          <p className="font-bold text-lg text-primary">₹{totalAmount}</p>
        </div>
      </div>

      {/* ── Navigation Buttons ── */}
      <div className="pt-2 pb-2 flex gap-2.5 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="gap-1.5 sm:gap-2 rounded-xl text-xs sm:text-sm h-11 shrink-0 px-3 sm:px-4 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Button>
        <Button
          type="button"
          disabled={!parsedRange.valid || hasInvalidRange}
          onClick={onNext}
          className="gap-1.5 sm:gap-2 rounded-xl text-xs sm:text-sm h-11 flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 px-3 sm:px-4 cursor-pointer"
        >
          Continue to Payment <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Fullscreen Zoom / Inspect Modal ── */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8"
            onClick={() => setIsZoomed(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl max-h-[90vh] w-full bg-card rounded-2xl border border-border shadow-2xl p-4 sm:p-6 flex flex-col gap-4 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b pb-3 border-border/50">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground truncate max-w-[300px] sm:max-w-md">
                      {currentFile?.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Page {activePageNum} of {docPages}
                      {isFiltered && ` (Selected ${currentIndex + 1} of ${navigablePages.length})`} • {paperSize} {isLandscape ? "Landscape" : "Portrait"} • {isColor ? "Colour Print" : "Black & White"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {docPages > 1 && (
                    <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-xl text-xs font-mono">
                      <button
                        type="button"
                        disabled={!canGoPrev}
                        onClick={handlePrevPage}
                        className="p-1 rounded-md hover:bg-background text-foreground disabled:opacity-30 transition-colors cursor-pointer"
                        title={isFiltered ? "Previous selected page" : "Previous page"}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="font-semibold text-foreground px-1">
                        {activePageNum} / {docPages}
                        {isFiltered && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({currentIndex + 1}/{navigablePages.length})
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={!canGoNext}
                        onClick={handleNextPage}
                        className="p-1 rounded-md hover:bg-background text-foreground disabled:opacity-30 transition-colors cursor-pointer"
                        title={isFiltered ? "Next selected page" : "Next page"}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsZoomed(false)}
                    className="p-1.5 rounded-lg bg-muted text-foreground/80 hover:bg-muted/80 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  "flex-1 min-h-[350px] max-h-[70vh] flex items-center justify-center overflow-auto rounded-xl bg-zinc-100 p-4",
                  !isColor && "grayscale contrast-[1.06]"
                )}
              >
                {isImage && currentUrl ? (
                  <img
                    src={currentUrl}
                    alt={currentFile?.name}
                    className="max-h-[65vh] max-w-full object-contain rounded shadow-md"
                  />
                ) : isPdf && activeSingleUrl ? (
                  activeSingleUrl.startsWith("data:image/") ? (
                    <img
                      key={`zoom-pdf-img-${activeFileIndex}-${activePageNum}`}
                      src={activeSingleUrl}
                      alt={currentFile?.name}
                      className="max-h-[72vh] max-w-full object-contain rounded shadow-lg bg-white"
                    />
                  ) : (
                    <iframe
                      key={`zoom-pdf-${activeFileIndex}-${activePageNum}`}
                      src={`${activeSingleUrl}#toolbar=1&navpanes=0&view=Fit`}
                      title="PDF Zoom Preview"
                      className="w-full h-[65vh] rounded border-none bg-white"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-muted-foreground font-mono">
                      Loading page {activePageNum}...
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
