"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PrintFile, calcFilesAmount, parsePageRange, BW_RATE, COLOR_RATE, BW_A3_RATE, COLOR_A3_RATE, MIN_JOB_AMOUNT } from "@/lib/printStore";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, FileText, FileImage, File as FileIcon, Settings, Info, Minus, Plus, X, Pencil, Eye, Check, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { renderPdfPageToDataUrl } from "@/lib/pdfRenderer";
import { cn } from "@/lib/utils";

interface Props {
  files: PrintFile[];
  onUpdateFiles: (files: PrintFile[]) => void;
  onBack: () => void;
  onNext: () => void;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type === "application/pdf") return FileText;
  return FileIcon;
}

export function PrintOptions({ files, onUpdateFiles, onBack, onNext }: Props) {
  const [globalDoubleSided, setGlobalDoubleSided] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [peekIdx, setPeekIdx] = useState<number | null>(null);
  const [peekPage, setPeekPage] = useState<number>(1);
  const [peekPreviewUrl, setPeekPreviewUrl] = useState<string | null>(null);
  const [isPeekLoading, setIsPeekLoading] = useState(false);
  const peekBlobUrlRef = React.useRef<string | null>(null);

  const { bwPages, colorPages, bwA3Pages, colorA3Pages, totalPages, totalAmount } = calcFilesAmount(files);

  const startRename = (idx: number, currentName: string) => {
    setEditingIdx(idx);
    const lastDot = currentName.lastIndexOf(".");
    if (lastDot > 0) {
      setEditName(currentName.substring(0, lastDot));
    } else {
      setEditName(currentName);
    }
  };

  const saveRename = (idx: number) => {
    if (!editName.trim()) {
      setEditingIdx(null);
      return;
    }
    const currentFile = files[idx];
    const lastDot = currentFile.name.lastIndexOf(".");
    const ext = lastDot > 0 ? currentFile.name.substring(lastDot) : "";
    const cleanBase = editName.trim();
    const finalName = cleanBase.toLowerCase().endsWith(ext.toLowerCase()) ? cleanBase : `${cleanBase}${ext}`;

    const newFiles = [...files];
    try {
      const renamedFileObj = new File([currentFile.file], finalName, { type: currentFile.file.type });
      newFiles[idx] = {
        ...currentFile,
        name: finalName,
        file: renamedFileObj,
      };
    } catch {
      newFiles[idx] = {
        ...currentFile,
        name: finalName,
      };
    }
    onUpdateFiles(newFiles);
    setEditingIdx(null);
  };

  const cancelRename = () => {
    setEditingIdx(null);
    setEditName("");
  };

  const cleanupPeekBlob = () => {
    if (peekBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(peekBlobUrlRef.current);
      } catch {}
      peekBlobUrlRef.current = null;
    }
  };

  const loadPeekPreview = async (idx: number, page: number) => {
    const target = files[idx];
    if (!target) return;

    cleanupPeekBlob();
    setPeekPreviewUrl(null);
    setIsPeekLoading(true);

    const isPdf = target.type === "application/pdf" || (target.name || "").toLowerCase().endsWith(".pdf");
    const isImage = target.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|svg|heic)$/i.test(target.name || "");

    if (isImage) {
      try {
        const u = URL.createObjectURL(target.file);
        peekBlobUrlRef.current = u;
        setPeekPreviewUrl(u);
      } catch (e) {
        console.error("Error creating image preview URL", e);
      } finally {
        setIsPeekLoading(false);
      }
      return;
    }

    if (isPdf) {
      try {
        // High-fidelity rendering via PDF.js (scale 1.8 for crisp display)
        const res = await renderPdfPageToDataUrl(target.file, page, 1.8);
        if (res?.dataUrl) {
          setPeekPreviewUrl(res.dataUrl);
          setIsPeekLoading(false);
          return;
        }

        // Secondary fallback: slice single page with pdf-lib
        const { PDFDocument } = await import("pdf-lib");
        const arrayBuffer = await target.file.arrayBuffer();
        const sourceDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const total = sourceDoc.getPageCount();
        const safePage = Math.min(Math.max(1, page), total);
        const singleDoc = await PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(sourceDoc, [safePage - 1]);
        singleDoc.addPage(copiedPage);
        const pdfBytes = await singleDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
        const u = URL.createObjectURL(blob);
        peekBlobUrlRef.current = u;
        setPeekPreviewUrl(u);
      } catch (err) {
        console.error("Failed to render PDF quick peek", err);
        try {
          const u = URL.createObjectURL(target.file);
          peekBlobUrlRef.current = u;
          setPeekPreviewUrl(u);
        } catch {}
      } finally {
        setIsPeekLoading(false);
      }
      return;
    }

    // Generic fallback for any other allowed file format
    try {
      const u = URL.createObjectURL(target.file);
      peekBlobUrlRef.current = u;
      setPeekPreviewUrl(u);
    } catch {} finally {
      setIsPeekLoading(false);
    }
  };

  const openQuickPeek = (idx: number) => {
    setPeekIdx(idx);
    setPeekPage(1);
    loadPeekPreview(idx, 1);
  };

  const handlePeekPageChange = (newPage: number) => {
    if (peekIdx === null) return;
    setPeekPage(newPage);
    loadPeekPreview(peekIdx, newPage);
  };

  const closeQuickPeek = () => {
    cleanupPeekBlob();
    setPeekIdx(null);
    setPeekPage(1);
    setPeekPreviewUrl(null);
    setIsPeekLoading(false);
  };

  const removeFile = (idx: number) => {
    if (files.length <= 1) return;
    const updated = files.filter((_, i) => i !== idx);
    onUpdateFiles(updated);
  };

  const updateCopies = (index: number, delta: number) => {
    const newFiles = [...files];
    const currentSettings = newFiles[index].settings || { color: false, copies: 1, layout: 'portrait', pages: 1, doubleSided: false };
    const newCopies = Math.max(1, currentSettings.copies + delta);
    newFiles[index].settings = { ...currentSettings, copies: newCopies };
    onUpdateFiles(newFiles);
  };

  const setColorMode = (index: number, color: boolean) => {
    const newFiles = [...files];
    const currentSettings = newFiles[index].settings || { color: false, copies: 1, layout: 'portrait', pages: 1, doubleSided: false };
    if (currentSettings.color === color) return;
    newFiles[index].settings = { ...currentSettings, color };
    onUpdateFiles(newFiles);
  };

  const setPaperSize = (index: number, paperSize: "A4" | "A3") => {
    const newFiles = [...files];
    const currentSettings = newFiles[index].settings || { color: false, copies: 1, layout: 'portrait', pages: 1, doubleSided: false };
    if (currentSettings.paperSize === paperSize) return;
    newFiles[index].settings = { ...currentSettings, paperSize };
    onUpdateFiles(newFiles);
  };


  const updateAllCopies = (delta: number) => {
    const newFiles = [...files];
    let allUpdated = false;
    for (let i = 0; i < newFiles.length; i++) {
      const currentSettings = newFiles[i].settings || { color: false, copies: 1, layout: 'portrait', pages: 1, doubleSided: false };
      const newCopies = Math.max(1, currentSettings.copies + delta);
      if (newCopies !== currentSettings.copies) allUpdated = true;
      newFiles[i].settings = { ...currentSettings, copies: newCopies };
    }
    if (allUpdated) onUpdateFiles(newFiles);
  };

  const toggleDoubleSided = (index: number) => {
    const newFiles = [...files];
    const current = newFiles[index].settings?.doubleSided || false;
    if (newFiles[index].settings) {
      newFiles[index].settings!.doubleSided = !current;
    }
    onUpdateFiles(newFiles);
  };

  const toggleAllDoubleSided = () => {
    const newVal = !globalDoubleSided;
    setGlobalDoubleSided(newVal);
    const newFiles = [...files];
    newFiles.forEach(f => {
      if (f.settings) {
        f.settings.doubleSided = newVal;
      }
    });
    onUpdateFiles(newFiles);
  };

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <div className="flex items-center gap-2 mb-1 text-primary">
          <Settings className="h-5 w-5" />
          <h2 className="text-xl font-bold text-foreground">Print Settings</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Customize options for each file.
        </p>
      </div>

      {files.length > 1 && (
        <div className="space-y-2">
          {/* Global Copies Control */}
          <div className="flex items-center justify-between bg-primary/5 rounded-xl px-4 py-2 border border-primary/10">
            <span className="text-sm font-semibold text-primary">Apply copies to all</span>
            <div className="flex items-center gap-1.5 shrink-0 bg-background/50 rounded-lg p-1 border border-border/40">
              <button
                type="button"
                onClick={() => updateAllCopies(-1)}
                className="p-1 rounded bg-background shadow-sm hover:bg-muted text-muted-foreground transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-xs font-semibold px-2 text-center text-muted-foreground">Copies</span>
              <button
                type="button"
                onClick={() => updateAllCopies(1)}
                className="p-1 rounded bg-background shadow-sm hover:bg-muted text-muted-foreground transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10 cursor-pointer" onClick={toggleAllDoubleSided}>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Set all to double-sided</p>
            <p className="text-[11px] text-muted-foreground">Apply double-sided printing to all files</p>
          </div>
          <div className={cn(
            "w-10 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out relative",
            globalDoubleSided ? "bg-primary" : "bg-muted-foreground/30"
          )}>
            <div className={cn(
              "w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out",
              globalDoubleSided ? "translate-x-4" : "translate-x-0"
            )} />
          </div>
        </div>
        </div>
      )}

      <div className="space-y-3">
        {files.map((f, idx) => {
          const Icon = fileIcon(f.type);
          const isDoubleSided = f.settings?.doubleSided || false;
          const isColor = f.settings?.color || false;
          const docPages = f.settings?.pages || 1;
          const rangeRes = parsePageRange(f.settings?.pageRange, docPages, f.settings?.pageMode);
          const pages = rangeRes.valid ? rangeRes.count : docPages;
          const copies = f.settings?.copies || 1;
          const paperSize = f.settings?.paperSize || "A4";
          const isA3 = paperSize === "A3";
          const bwRate = isA3 ? BW_A3_RATE : BW_RATE;
          const colorRate = isA3 ? COLOR_A3_RATE : COLOR_RATE;
          const rate = isColor ? colorRate : bwRate;
          const fileSubtotal = pages * copies * rate;

          return (
            <motion.div
              key={f.name + idx}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-3 transition-colors",
                isColor
                  ? "bg-rose-500/[0.03] border-rose-500/25"
                  : "bg-card/60 border-border/50"
              )}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* File Serial Number */}
                  <span className="flex items-center justify-center h-5 w-5 rounded-md bg-muted/80 text-[11px] font-mono font-bold text-muted-foreground shrink-0 border border-border/60">
                    {idx + 1}
                  </span>
                  <div className={cn("p-1.5 rounded-lg shrink-0", isColor ? "bg-rose-500/10" : "bg-primary/10")}>
                    <Icon className={cn("h-4 w-4", isColor ? "text-rose-500" : "text-primary")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {editingIdx === idx ? (
                      <div className="flex items-center gap-1.5 py-0.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(idx);
                            if (e.key === "Escape") cancelRename();
                          }}
                          autoFocus
                          className="h-7 px-2 text-xs font-semibold bg-background border border-primary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-full max-w-[200px]"
                          placeholder="File name"
                        />
                        <button
                          type="button"
                          onClick={() => saveRename(idx)}
                          className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
                          title="Save name"
                          aria-label="Save name"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer shrink-0"
                          title="Cancel"
                          aria-label="Cancel rename"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate max-w-[150px] sm:max-w-[210px]" title={f.name}>
                          {f.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => startRename(idx, f.name)}
                          className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                          title="Rename document"
                          aria-label="Rename document"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openQuickPeek(idx)}
                          className="p-1 rounded-md text-primary/75 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                          title="Quick peek at document"
                          aria-label="Quick peek at document"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-semibold text-foreground/80 uppercase">{paperSize}</span> &bull; {pages} pg{pages !== 1 ? 's' : ''} &bull;{" "}
                      <motion.span
                        key={fileSubtotal}
                        initial={{ scale: 0.85, opacity: 0.6 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="inline-block font-bold text-foreground/90"
                      >
                        ₹{fileSubtotal}
                      </motion.span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Copies Stepper */}
                  <div className="flex items-center gap-1.5 bg-muted/40 rounded-xl px-2 py-1 border border-border/50">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pr-0.5">Copies</span>
                    <div className="flex items-center gap-1 bg-background rounded-lg p-0.5 border border-border/40 shadow-xs">
                      <button
                        type="button"
                        onClick={() => updateCopies(idx, -1)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors cursor-pointer"
                        disabled={(f.settings?.copies || 1) <= 1}
                        title="Decrease copies"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center font-mono">{f.settings?.copies || 1}</span>
                      <button
                        type="button"
                        onClick={() => updateCopies(idx, 1)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                        title="Increase copies"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Quick remove button if multi-file */}
                  {files.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title="Remove this file"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>              {/* Controls Row: Paper Size (A4/A3) + B&W/Colour + Duplex */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2 border-t border-border/40">
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                  {/* Paper Size Pill: A4 vs A3 */}
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-muted/70 dark:bg-muted/40 border border-border/70 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPaperSize(idx, "A4")}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                        !isA3
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="A4 Standard Sheet (210×297mm)"
                    >
                      <span>A4</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperSize(idx, "A3")}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                        isA3
                          ? "bg-primary text-primary-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="A3 Large Sheet (297×420mm)"
                    >
                      <span>A3</span>
                    </button>
                  </div>

                  {/* Clean Segmented Color / B&W Toggle with dynamic rate */}
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-muted/70 dark:bg-muted/40 border border-border/70 shrink-0">
                    <button
                      type="button"
                      onClick={() => setColorMode(idx, false)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                        !isColor
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Switch to Black & White print"
                    >
                      <span>B&W</span>
                      <span className="text-[10px] font-mono opacity-60 font-normal">₹{bwRate}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorMode(idx, true)}
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
                        ₹{colorRate}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Duplex Toggle (Clean mobile touch target) */}
                {(() => {
                  const isSinglePage = pages <= 1;
                  return (
                    <div
                      className={cn(
                        "flex items-center justify-between sm:justify-end gap-2 select-none transition-opacity py-0.5",
                        isSinglePage ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      )}
                      onClick={() => !isSinglePage && toggleDoubleSided(idx)}
                      title={isSinglePage ? "Single-page documents cannot be printed double-sided" : undefined}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-foreground">
                          Double-sided {isSinglePage && <span className="text-[10px] text-muted-foreground font-normal">(N/A)</span>}
                        </span>
                        <div className="relative group flex items-center">
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          <div className="absolute bottom-full mb-2 right-0 w-48 p-2 bg-card border border-border text-foreground text-[10px] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {isSinglePage
                              ? "Single-page documents cannot be printed double-sided."
                              : "Prints on both sides to save paper."}
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0",
                        !isSinglePage && isDoubleSided ? "bg-primary" : "bg-muted-foreground/30"
                      )}>
                        <div className={cn(
                          "w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out",
                          !isSinglePage && isDoubleSided ? "translate-x-4" : "translate-x-0"
                        )} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Live Total Cost Summary — Enhanced Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/8 via-primary/4 to-transparent border border-primary/15 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Order Summary</span>
            <p className="text-sm font-extrabold text-foreground">
              {files.length} {files.length === 1 ? "File" : "Files"} &bull; {totalPages} {totalPages === 1 ? "Page" : "Pages"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Estimated Total</span>
            <motion.p
              key={totalAmount}
              initial={{ scale: 0.85, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="font-black text-2xl text-primary tracking-tight"
            >
              ₹{totalAmount}
            </motion.p>
          </div>
        </div>

        {/* Breakdown tag chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-primary/10 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            {bwPages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-background/80 text-foreground font-semibold border border-border/60 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{bwPages} A4 B&amp;W</span>
              </span>
            )}
            {colorPages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/25 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{colorPages} A4 Colour</span>
              </span>
            )}
            {bwA3Pages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/25 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>{bwA3Pages} A3 B&amp;W</span>
              </span>
            )}
            {colorA3Pages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/25 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                <span>{colorA3Pages} A3 Colour</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="pt-2 pb-2 flex gap-3 sticky bottom-0 bg-background/80 backdrop-blur-md -mx-4 px-4 sm:mx-0 sm:px-0 z-10">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 rounded-xl h-12 text-sm border-border/60 hover:bg-muted/50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          className="flex-1 rounded-xl h-12 text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-bold"
        >
          Continue to Preview
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* ── Quick Peek Modal (Eye Button) ── */}
      <AnimatePresence>
        {peekIdx !== null && files[peekIdx] && (() => {
          const currentPeekFile = files[peekIdx];
          const isPdf = currentPeekFile.type === "application/pdf" || (currentPeekFile.name || "").toLowerCase().endsWith(".pdf");
          const isImage = currentPeekFile.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|svg|heic)$/i.test(currentPeekFile.name || "");
          const isCurrentBw = !currentPeekFile.settings?.color;
          const docTotalPages = Math.max(1, currentPeekFile.settings?.pages || 1);
          const paperSize = currentPeekFile.settings?.paperSize || "A4";

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6"
              onClick={closeQuickPeek}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-lg w-full bg-card rounded-2xl border border-border shadow-2xl p-4 sm:p-5 flex flex-col gap-3.5 overflow-hidden"
              >
                {/* Peek Header */}
                <div className="flex items-center justify-between gap-2 border-b pb-3 border-border/50">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                      <Eye className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-foreground truncate" title={currentPeekFile.name}>
                        {currentPeekFile.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] sm:text-[11px] text-muted-foreground font-mono">
                          {paperSize} &bull; {docTotalPages} page{docTotalPages !== 1 ? 's' : ''}
                        </span>
                        <span className={cn(
                          "text-[9.5px] font-bold px-2 py-0.2 rounded-full border leading-tight",
                          isCurrentBw
                            ? "bg-zinc-800/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        )}>
                          {isCurrentBw ? "B&W Preview" : "Colour Preview"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeQuickPeek}
                    className="p-1.5 rounded-xl bg-muted/80 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer shrink-0"
                    title="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Peek Document Body */}
                <div className="relative min-h-[300px] max-h-[62vh] flex items-center justify-center overflow-hidden rounded-xl bg-zinc-950/60 p-2 border border-border/50">
                  {isPeekLoading ? (
                    <div className="flex flex-col items-center justify-center gap-2.5 p-8 text-center">
                      <Loader2 className="h-7 w-7 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground font-mono">
                        Rendering page {peekPage}...
                      </p>
                    </div>
                  ) : peekPreviewUrl ? (
                    isImage || peekPreviewUrl.startsWith("data:image/") ? (
                      <img
                        key={`peek-img-${peekIdx}-${peekPage}`}
                        src={peekPreviewUrl}
                        alt={currentPeekFile.name}
                        className={cn(
                          "max-h-[58vh] max-w-full object-contain rounded-lg shadow-lg transition-all duration-300",
                          isCurrentBw && "grayscale contrast-[1.06] brightness-[0.98]"
                        )}
                      />
                    ) : (
                      <object
                        key={`peek-obj-${peekIdx}-${peekPage}`}
                        data={`${peekPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                        type="application/pdf"
                        className={cn(
                          "w-full h-[58vh] rounded-lg border-none bg-white shadow-lg transition-all duration-300",
                          isCurrentBw && "grayscale contrast-[1.06] brightness-[0.98]"
                        )}
                      >
                        <iframe
                          src={`${peekPreviewUrl}#toolbar=0&navpanes=0&view=Fit`}
                          title="Document Preview"
                          className="w-full h-[58vh] rounded-lg border-none bg-white"
                        />
                      </object>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground">Unable to render preview for this file</p>
                    </div>
                  )}
                </div>

                {/* Peek Footer Controls */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {/* Page Navigator if multi-page */}
                  {docTotalPages > 1 ? (
                    <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/50">
                      <button
                        type="button"
                        onClick={() => handlePeekPageChange(peekPage - 1)}
                        disabled={peekPage <= 1 || isPeekLoading}
                        className="p-1 rounded-lg hover:bg-muted text-foreground/80 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Previous page"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[11px] font-mono font-semibold text-foreground px-1.5 text-center min-w-[55px]">
                        {peekPage} / {docTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePeekPageChange(peekPage + 1)}
                        disabled={peekPage >= docTotalPages || isPeekLoading}
                        className="p-1 rounded-lg hover:bg-muted text-foreground/80 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Next page"
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const idxToEdit = peekIdx;
                        closeQuickPeek();
                        if (idxToEdit !== null) {
                          startRename(idxToEdit, files[idxToEdit].name);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Rename this file</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    {docTotalPages > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const idxToEdit = peekIdx;
                          closeQuickPeek();
                          if (idxToEdit !== null) {
                            startRename(idxToEdit, files[idxToEdit].name);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" />
                        <span className="hidden sm:inline">Rename</span>
                      </button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={closeQuickPeek}
                      className="rounded-xl text-xs h-8 px-4 font-semibold cursor-pointer"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
