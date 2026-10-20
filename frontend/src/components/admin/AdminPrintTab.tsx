"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  FileImage,
  File as FileIcon,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Info,
  ShieldCheck,
  Plus,
  Minus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ui/Loader";
import {
  PrintFile,
  parsePageRange,
  BW_RATE,
  COLOR_RATE,
  BW_A3_RATE,
  COLOR_A3_RATE,
} from "@/lib/printStore";
import { countPdfPages, renderPdfPageToDataUrl } from "@/lib/pdfRenderer";

interface AdminPrintTabProps {
  onJobSubmitted?: () => void;
}

export function AdminPrintTab({ onJobSubmitted }: AdminPrintTabProps) {
  const [files, setFiles] = useState<PrintFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [activePageNum, setActivePageNum] = useState(1);
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const [pdfPageUrls, setPdfPageUrls] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submittedCount, setSubmittedCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [copiesInput, setCopiesInput] = useState<string | null>(null);

  useEffect(() => {
    setCopiesInput(null);
  }, [activeFileIndex]);

  const currentFile = files[activeFileIndex] || files[0];
  const currentSettings = currentFile?.settings || {
    color: false,
    copies: 1,
    layout: "portrait",
    pages: 1,
    doubleSided: false,
    paperSize: "A4",
    pagesPerSheet: 1,
    pageRange: "all",
    pageMode: "all",
  };

  const docPages = Math.max(1, currentSettings.pages || 1);
  const isLandscape = currentSettings.layout === "landscape";
  const isColor = currentSettings.color || false;
  const paperSize = currentSettings.paperSize || "A4";
  const pagesPerSheet = currentSettings.pagesPerSheet || 1;
  const isA3 = paperSize === "A3";

  // Parse page range
  const parsedRange = useMemo(() => {
    return parsePageRange(
      currentSettings.pageRange,
      docPages,
      currentSettings.pageMode
    );
  }, [currentSettings.pageRange, docPages, currentSettings.pageMode]);

  // Effective pages list taking page range into account
  const effectivePages: number[] = useMemo(() => {
    if (parsedRange?.pages && parsedRange.pages.length > 0) {
      return parsedRange.pages;
    }
    return Array.from({ length: docPages }, (_, i) => i + 1);
  }, [parsedRange, docPages]);

  const isSingleItem = currentFile?.type?.startsWith("image/") || effectivePages.length <= 1;

  // Total physical sheets needed
  const totalSheets = useMemo(() => {
    if (isSingleItem) return 1;
    return Math.max(1, Math.ceil(effectivePages.length / pagesPerSheet));
  }, [isSingleItem, effectivePages.length, pagesPerSheet]);

  // Current physical sheet index (0-based)
  const activeSheetIndex = useMemo(() => {
    if (isSingleItem) return 0;
    const pIdx = Math.max(0, activePageNum - 1);
    return Math.min(totalSheets - 1, Math.floor(pIdx / pagesPerSheet));
  }, [isSingleItem, activePageNum, pagesPerSheet, totalSheets]);

  // Array of page numbers (or null for empty slots) to display in the N-Up grid
  const currentSlotPages = useMemo(() => {
    const isImage = currentFile?.type?.startsWith("image/");
    if (isImage || effectivePages.length <= 1) {
      // For images or 1-page documents, duplicate across slots (tiled flyer/slip layout)
      return Array.from({ length: pagesPerSheet }, () => 1);
    }
    const startIdx = activeSheetIndex * pagesPerSheet;
    const slots: (number | null)[] = [];
    for (let i = 0; i < pagesPerSheet; i++) {
      const pIdx = startIdx + i;
      if (pIdx < effectivePages.length) {
        slots.push(effectivePages[pIdx]);
      } else {
        slots.push(null);
      }
    }
    return slots;
  }, [currentFile, effectivePages, pagesPerSheet, activeSheetIndex]);

  // Object URLs for images & preview
  useEffect(() => {
    const urls: Record<number, string> = {};
    files.forEach((f, idx) => {
      try {
        urls[idx] = URL.createObjectURL(f.file);
      } catch (e) {
        console.error(e);
      }
    });
    setPreviewUrls(urls);
    return () => {
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files.map((f) => f.name + f.size).join(",")]);

  // Render all active PDF pages needed for the current sheet preview
  useEffect(() => {
    if (!currentFile || currentFile.type !== "application/pdf") return;

    const pagesToFetch = currentSlotPages.filter((p): p is number => p !== null);
    let active = true;

    pagesToFetch.forEach((p) => {
      const cacheKey = `${activeFileIndex}-${p}`;
      if (pdfPageUrls[cacheKey]) return;

      renderPdfPageToDataUrl(currentFile.file, p, 1.2)
        .then((res) => {
          if (active && res?.dataUrl) {
            setPdfPageUrls((prev) => ({ ...prev, [cacheKey]: res.dataUrl }));
          }
        })
        .catch((err) => console.error("Admin PDF preview error:", err));
    });

    return () => {
      active = false;
    };
  }, [activeFileIndex, currentSlotPages, currentFile]);

  // File Upload Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setErrorMsg("");
    const newSelectedFiles: File[] = Array.from(e.target.files);

    const added: PrintFile[] = [];
    for (const f of newSelectedFiles) {
      let pageCount = 1;
      if (f.type === "application/pdf") {
        try {
          pageCount = await countPdfPages(f);
        } catch {
          pageCount = 1;
        }
      }
      added.push({
        name: f.name,
        size: f.size,
        type: f.type,
        file: f,
        settings: {
          color: false,
          copies: 1,
          layout: "portrait",
          pages: pageCount,
          doubleSided: false,
          paperSize: "A4",
          pagesPerSheet: 1,
          pageRange: "all",
          pageMode: "all",
        },
      });
    }

    setFiles((prev) => [...prev, ...added]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    if (activeFileIndex >= updated.length) {
      setActiveFileIndex(Math.max(0, updated.length - 1));
    }
  };

  // Setting Mutators
  const updateCurrentSettings = (partial: Partial<NonNullable<PrintFile["settings"]>>) => {
    if (!currentFile) return;
    const updated = [...files];
    updated[activeFileIndex] = {
      ...currentFile,
      settings: {
        ...(currentFile.settings || {
          color: false,
          copies: 1,
          layout: "portrait",
          pages: 1,
          doubleSided: false,
          paperSize: "A4",
          pagesPerSheet: 1,
          pageRange: "all",
          pageMode: "all",
        }),
        ...partial,
      },
    };
    setFiles(updated);
  };

  const applyToAllFiles = (partial: Partial<NonNullable<PrintFile["settings"]>>) => {
    const updated = files.map((f) => ({
      ...f,
      settings: {
        ...(f.settings || {
          color: false,
          copies: 1,
          layout: "portrait",
          pages: 1,
          doubleSided: false,
          paperSize: "A4",
          pagesPerSheet: 1,
          pageRange: "all",
          pageMode: "all",
        }),
        ...partial,
      },
    }));
    setFiles(updated);
  };

  // Submit to Printer Queue directly
  const handleDirectPrint = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setErrorMsg("");

    try {
      const uploadPromises = files.map(async (pf) => {
        const formData = new FormData();
        formData.append("file", pf.file);
        formData.append("copies", (pf.settings?.copies || 1).toString());
        formData.append("doubleSided", pf.settings?.doubleSided ? "true" : "false");
        formData.append("color", pf.settings?.color ? "true" : "false");
        formData.append("layout", pf.settings?.layout || "portrait");
        formData.append("paperSize", pf.settings?.paperSize || "A4");
        formData.append("pagesPerSheet", (pf.settings?.pagesPerSheet || 1).toString());
        formData.append("pageRange", pf.settings?.pageRange || "all");
        formData.append("userName", "Printed by Admin");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to spool ${pf.name}`);
        }
        return res.json();
      });

      await Promise.all(uploadPromises);
      setSubmittedCount(files.length);
      setSubmitSuccess(true);
      setFiles([]);
    } catch (err: any) {
      console.error("Direct print failed:", err);
      setErrorMsg(err.message || "Failed to submit print job");
    } finally {
      setIsUploading(false);
    }
  };

  // Render an individual page slot inside the N-Up physical sheet layout
  const renderSlotContent = (pageNum: number | null, slotIndex: number) => {
    if (pageNum === null) {
      return (
        <div className="w-full h-full min-h-0 border border-dashed border-zinc-300 rounded-none flex flex-col items-center justify-center p-1 text-center bg-zinc-50/40">
          <span className="text-[8px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
            Empty
          </span>
        </div>
      );
    }

    const isImage = currentFile?.type?.startsWith("image/");
    const imgUrl = isImage
      ? previewUrls[activeFileIndex]
      : pdfPageUrls[`${activeFileIndex}-${pageNum}`];

    const isSingle = pagesPerSheet === 1;

    return (
      <div
        className={cn(
          "relative w-full h-full min-h-0 overflow-hidden flex items-center justify-center group",
          isSingle
            ? "bg-transparent p-0 border-none shadow-none"
            : "bg-white rounded-none border border-zinc-200/80 shadow-2xs p-1"
        )}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`Page ${pageNum}`}
            className="w-full h-full object-contain pointer-events-none select-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 p-1 text-center">
            <Loader size="xs" />
            <span className="text-[8px] font-mono text-zinc-500">
              {isImage ? "Image" : `Page ${pageNum}`}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-5 overflow-y-auto pr-1">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Printer className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Direct Admin Print
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              👑 Admin Console
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Send documents directly to the printer queue with full controls. No payment gateway required.
          </p>
        </div>

        {files.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiles([])}
              className="text-xs h-9 rounded-xl border-border/60"
            >
              Clear All
            </Button>
            <Button
              size="sm"
              disabled={isUploading}
              onClick={handleDirectPrint}
              className="text-xs h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs px-4"
            >
              {isUploading ? (
                <>
                  <Loader size="xs" className="mr-1.5" />
                  Spooling to Printer…
                </>
              ) : (
                <>
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Print Now ({files.length} {files.length === 1 ? "file" : "files"})
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── Success Feedback Modal / Card ── */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Print Job Spooled Successfully!
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {submittedCount} {submittedCount === 1 ? "file has" : "files have"} been placed into the queue under <strong>"Printed by Admin"</strong>. The print daemon will print immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSubmitSuccess(false)}
                className="text-xs rounded-xl"
              >
                Print Another
              </Button>
              {onJobSubmitted && (
                <Button
                  size="sm"
                  onClick={onJobSubmitted}
                  className="text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  View in Print Logs
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error Banner ── */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Upload Box (Always visible or when empty) ── */}
      {files.length === 0 ? (
        <div className="flex-1 min-h-[350px] border-2 border-dashed border-border/80 hover:border-primary/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors bg-card/40">
          <div className="p-4 rounded-2xl bg-primary/10 text-primary mb-3">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            Drop your documents here to print
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Supports PDF, PNG, JPG, and HEIC files. You can upload multiple files at once.
          </p>

          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs transition-all">
              <UploadCloud className="h-4 w-4" />
              Browse Files from Computer
            </span>
            <input
              type="file"
              multiple
              accept="application/pdf,image/*,.heic,.heif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        /* ── Two-Column Layout (Controls + Live Preview) ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
          {/* Left Column: File Tabs & Print Options (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* File Switcher Bar */}
            <div className="flex items-center justify-between gap-2 p-1.5 bg-muted/60 dark:bg-muted/30 rounded-2xl border border-border/60">
              <button
                type="button"
                disabled={activeFileIndex === 0}
                onClick={() => {
                  setActiveFileIndex(activeFileIndex - 1);
                  setActivePageNum(1);
                }}
                className="p-2 rounded-xl hover:bg-background text-foreground disabled:opacity-30 transition-all cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="relative flex-1 min-w-0 flex items-center justify-center">
                <select
                  value={activeFileIndex}
                  onChange={(e) => {
                    setActiveFileIndex(parseInt(e.target.value, 10));
                    setActivePageNum(1);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                >
                  {files.map((f, idx) => (
                    <option key={f.name + idx} value={idx}>
                      {idx + 1}. {f.name} ({f.settings?.paperSize || "A4"}, {f.settings?.pages || 1} pgs)
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border/50 text-xs font-semibold truncate pointer-events-none">
                  <span className="font-bold text-primary">
                    {activeFileIndex + 1}/{files.length}
                  </span>
                  <span className="truncate max-w-[180px] sm:max-w-xs">{currentFile?.name}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-muted">
                    {paperSize}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={activeFileIndex === files.length - 1}
                  onClick={() => {
                    setActiveFileIndex(activeFileIndex + 1);
                    setActivePageNum(1);
                  }}
                  className="p-2 rounded-xl hover:bg-background text-foreground disabled:opacity-30 transition-all cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeFile(activeFileIndex)}
                  className="p-2 rounded-xl hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                  title="Remove file"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Add More Files */}
            <div className="flex items-center justify-between text-xs px-1">
              <label className="cursor-pointer text-primary hover:underline font-semibold flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Add more documents
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/*,.heic,.heif"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              {files.length > 1 && (
                <button
                  type="button"
                  onClick={() => applyToAllFiles(currentSettings)}
                  className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
                >
                  Apply these settings to all {files.length} files
                </button>
              )}
            </div>

            {/* ── Settings Controls Card ── */}
            <div className="p-4 rounded-2xl bg-card border border-border/70 space-y-4 shadow-2xs">
              {/* Row 1: Paper Size & Color Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Paper Size (A4 vs A3) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80 block">
                    Paper Sheet Size
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl border border-border/50">
                    <button
                      type="button"
                      onClick={() => updateCurrentSettings({ paperSize: "A4" })}
                      className={cn(
                        "py-1.5 rounded-lg text-xs font-bold transition-all",
                        paperSize === "A4"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      A4 Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrentSettings({ paperSize: "A3" })}
                      className={cn(
                        "py-1.5 rounded-lg text-xs font-bold transition-all",
                        paperSize === "A3"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      A3 Large
                    </button>
                  </div>
                </div>

                {/* Color Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80 block">
                    Color Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl border border-border/50">
                    <button
                      type="button"
                      onClick={() => updateCurrentSettings({ color: false })}
                      className={cn(
                        "py-1.5 rounded-lg text-xs font-bold transition-all",
                        !isColor
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Black &amp; White
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrentSettings({ color: true })}
                      className={cn(
                        "py-1.5 rounded-lg text-xs font-bold transition-all",
                        isColor
                          ? "bg-rose-500 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Colour Print
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Pages Per Sheet (N-Up) ⭐ Requested Feature */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Pages Per Sheet (N-Up)
                  </label>
                  <span className="text-[10.5px] text-muted-foreground">
                    {pagesPerSheet === 1
                      ? "1 page per physical sheet (Standard)"
                      : `${pagesPerSheet} pages scaled side-by-side on 1 sheet`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50">
                  <button
                    type="button"
                    onClick={() => updateCurrentSettings({ pagesPerSheet: 1 })}
                    className={cn(
                      "flex flex-col items-center py-2 px-1 rounded-lg text-xs font-semibold transition-all",
                      pagesPerSheet === 1
                        ? "bg-background text-foreground shadow-xs font-bold border border-border/40"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>1 Page</span>
                    <span className="text-[9.5px] font-normal opacity-70">Standard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCurrentSettings({ pagesPerSheet: 2 })}
                    className={cn(
                      "flex flex-col items-center py-2 px-1 rounded-lg text-xs font-semibold transition-all",
                      pagesPerSheet === 2
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>2-Up</span>
                    <span className="text-[9.5px] font-normal opacity-85">2 Pgs / Sheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCurrentSettings({ pagesPerSheet: 4 })}
                    className={cn(
                      "flex flex-col items-center py-2 px-1 rounded-lg text-xs font-semibold transition-all",
                      pagesPerSheet === 4
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>4-Up</span>
                    <span className="text-[9.5px] font-normal opacity-85">4 Pgs (2×2 Grid)</span>
                  </button>
                </div>
              </div>

              {/* Row 3: Copies & Duplex */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                {/* Copies */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/50">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground">Print Copies</span>
                    <p className="text-[10px] text-muted-foreground">Number of duplicate sets</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-background rounded-lg p-1 border border-border/60">
                    <button
                      type="button"
                      disabled={(currentSettings.copies || 1) <= 1}
                      onClick={() => {
                        setCopiesInput(null);
                        updateCurrentSettings({
                          copies: Math.max(1, (currentSettings.copies || 1) - 1),
                        });
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 cursor-pointer"
                      title="Decrease copies"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={copiesInput !== null ? copiesInput : (currentSettings.copies || 1)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        setCopiesInput(raw);
                        const val = parseInt(raw, 10);
                        if (!isNaN(val) && val > 0) {
                          updateCurrentSettings({
                            copies: Math.min(999, val),
                          });
                        }
                      }}
                      onBlur={() => {
                        if (copiesInput !== null) {
                          const val = parseInt(copiesInput, 10);
                          const finalCopies = !isNaN(val) && val >= 1 ? Math.min(999, val) : 1;
                          updateCurrentSettings({ copies: finalCopies });
                          setCopiesInput(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-12 text-center text-xs font-bold font-mono bg-transparent border border-transparent hover:border-border/60 focus:border-primary/60 focus:bg-muted/30 rounded py-0.5 outline-none transition-colors"
                      title="Click to type number of copies"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCopiesInput(null);
                        updateCurrentSettings({
                          copies: (currentSettings.copies || 1) + 1,
                        });
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
                      title="Increase copies"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Duplex Toggle */}
                <div
                  onClick={() =>
                    updateCurrentSettings({
                      doubleSided: !currentSettings.doubleSided,
                    })
                  }
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/50 cursor-pointer select-none"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground">Two-Sided (Duplex)</span>
                    <p className="text-[10px] text-muted-foreground">Print on both sides</p>
                  </div>
                  <div
                    className={cn(
                      "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out",
                      currentSettings.doubleSided ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out",
                        currentSettings.doubleSided ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Orientation */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <label className="text-xs font-semibold text-foreground/80 block">
                  Page Orientation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateCurrentSettings({ layout: "portrait" })}
                    className={cn(
                      "py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between",
                      !isLandscape
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span>Portrait</span>
                    <span className="text-[10px] font-normal opacity-80">Upright</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCurrentSettings({ layout: "landscape" })}
                    className={cn(
                      "py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between",
                      isLandscape
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span>Landscape</span>
                    <span className="text-[10px] font-normal opacity-80">Rotated</span>
                  </button>
                </div>
              </div>

              {/* Row 5: Pages to Print (All, Odd, Even, Custom) */}
              {docPages > 1 && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Pages to Print</span>
                    <span className="text-muted-foreground font-mono">({docPages} total)</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 p-1 bg-muted/60 rounded-xl border border-border/50">
                    {(["all", "odd", "even", "custom"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          updateCurrentSettings({
                            pageMode: mode,
                            pageRange:
                              mode === "odd"
                                ? "odd"
                                : mode === "even"
                                ? "even"
                                : mode === "all"
                                ? "all"
                                : currentSettings.pageRange === "all"
                                ? `1-${Math.min(docPages, 5)}`
                                : currentSettings.pageRange,
                          })
                        }
                        className={cn(
                          "py-1 rounded-lg text-xs font-semibold capitalize transition-all",
                          (currentSettings.pageMode || "all") === mode
                            ? "bg-background text-foreground shadow-xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {currentSettings.pageMode === "custom" && (
                    <input
                      type="text"
                      placeholder="e.g. 1-3, 5, 8"
                      value={currentSettings.pageRange === "all" ? "" : currentSettings.pageRange || ""}
                      onChange={(e) => updateCurrentSettings({ pageRange: e.target.value })}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-background border border-border focus:border-primary outline-none"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Sheet Preview Canvas (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Live Sheet Preview</span>
                {pagesPerSheet > 1 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-mono font-bold border border-primary/20">
                    {pagesPerSheet}-Up
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-mono transition-colors",
                  isA3 ? "text-primary font-bold" : "text-muted-foreground"
                )}
              >
                {paperSize} ({isA3 ? "297×420mm · 2× A4" : "210×297mm"})
              </span>
            </div>

            {/* Paper Mockup Container */}
            <div className="flex-1 min-h-[540px] xl:min-h-[620px] rounded-2xl bg-muted/40 border border-border/60 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
              <div
                className={cn(
                  "relative bg-white text-zinc-900 rounded-none shadow-xl shadow-black/20 ring-1 ring-black/10 overflow-hidden flex flex-col justify-between select-none",
                  isA3
                    ? (isLandscape
                        ? "w-[360px] sm:w-[440px] xl:w-[520px] 2xl:w-[560px] h-[254px] sm:h-[311px] xl:h-[368px] 2xl:h-[396px]"
                        : "w-[260px] sm:w-[325px] xl:w-[380px] 2xl:w-[410px] h-[368px] sm:h-[460px] xl:h-[537px] 2xl:h-[580px]")
                    : (isLandscape
                        ? "w-[300px] sm:w-[370px] xl:w-[440px] 2xl:w-[480px] h-[212px] sm:h-[262px] xl:h-[311px] 2xl:h-[339px]"
                        : "w-[215px] sm:w-[270px] xl:w-[320px] 2xl:w-[350px] h-[304px] sm:h-[382px] xl:h-[452px] 2xl:h-[495px]")
                )}
              >
                {/* Mockup Preview Area (Tiled N-Up Sheet Grid) */}
                <div
                  className={cn(
                    "relative w-full h-full overflow-hidden transition-all flex items-center justify-center",
                    pagesPerSheet === 1 ? "p-0 bg-white" : "p-2 bg-zinc-100/50",
                    !isColor && "grayscale contrast-[1.06] brightness-[0.98]"
                  )}
                >
                  {pagesPerSheet === 1 ? (
                    <div className="w-full h-full flex items-center justify-center">
                      {renderSlotContent(currentSlotPages[0], 0)}
                    </div>
                  ) : pagesPerSheet === 2 ? (
                    <div
                      className={cn(
                        "w-full h-full grid gap-1.5",
                        isLandscape
                          ? "grid-cols-2 grid-rows-1"
                          : "grid-cols-1 grid-rows-2"
                      )}
                    >
                      {renderSlotContent(currentSlotPages[0], 0)}
                      {renderSlotContent(currentSlotPages[1], 1)}
                    </div>
                  ) : (
                    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1.5">
                      {renderSlotContent(currentSlotPages[0], 0)}
                      {renderSlotContent(currentSlotPages[1], 1)}
                      {renderSlotContent(currentSlotPages[2], 2)}
                      {renderSlotContent(currentSlotPages[3], 3)}
                    </div>
                  )}
                </div>
              </div>

              {/* Sheet Stepper */}
              {(totalSheets > 1 || docPages > 1) && (
                <div className="flex flex-col items-center gap-1 mt-3 z-10">
                  <div className="flex items-center gap-2 bg-background/90 px-3 py-1 rounded-xl border border-border/60 text-xs font-mono shadow-2xs">
                    <button
                      type="button"
                      disabled={activeSheetIndex <= 0}
                      onClick={() => {
                        const prevSheet = activeSheetIndex - 1;
                        setActivePageNum(prevSheet * pagesPerSheet + 1);
                      }}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer transition-colors"
                      title="Previous Sheet"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[11px] font-semibold">
                      {pagesPerSheet > 1
                        ? `Sheet ${activeSheetIndex + 1} / ${totalSheets}`
                        : `Page ${activePageNum} / ${docPages}`}
                    </span>
                    <button
                      type="button"
                      disabled={activeSheetIndex >= totalSheets - 1}
                      onClick={() => {
                        const nextSheet = activeSheetIndex + 1;
                        setActivePageNum(nextSheet * pagesPerSheet + 1);
                      }}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer transition-colors"
                      title="Next Sheet"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {pagesPerSheet > 1 && !isSingleItem && (
                    <span className="text-[9.5px] text-muted-foreground font-mono">
                      Showing pages {currentSlotPages.filter((p): p is number => p !== null).join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Action Footer */}
            <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">
                  Ready to print {files.length} {files.length === 1 ? "file" : "files"}
                </p>
                <p className="text-[10.5px] text-muted-foreground">
                  Spools with Creator: <strong>"Printed by Admin"</strong>
                </p>
              </div>

              <Button
                disabled={isUploading}
                onClick={handleDirectPrint}
                className="rounded-xl h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader size="xs" className="mr-1.5" />
                    Spooling…
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4 mr-1.5" />
                    Send to Printer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
