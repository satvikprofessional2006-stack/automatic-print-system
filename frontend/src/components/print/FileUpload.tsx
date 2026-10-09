"use client";

import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, FileImage, File as FileIcon, Loader2, Sparkles, CircleDot } from "lucide-react";
import { PrintFile, BW_RATE, COLOR_RATE } from "@/lib/printStore";
import { cn } from "@/lib/utils";

interface Props {
  files: PrintFile[];
  onChange: (files: PrintFile[]) => void;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  ".heic",
  ".heif",
  "text/plain",
];

const MAX_FILE_MB = 20;

function fileIcon(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type === "application/pdf") return FileText;
  return FileIcon;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"bw" | "color">("bw");
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const isColorActive = activeTab === "color";

  const processFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
      setIsProcessing(true);
      const errs: string[] = [];
      const newFiles: PrintFile[] = [];

      for (let i = 0; i < fileList.length; i++) {
        let f = fileList[i];
        const isHeic = f.type === "image/heic" || f.type === "image/heif" || f.name.toLowerCase().endsWith(".heic");
        
        if (!ALLOWED_TYPES.includes(f.type) && !isHeic) {
          errs.push(`${f.name}: unsupported file type`);
          continue;
        }
        if (f.size > MAX_FILE_MB * 1024 * 1024) {
          errs.push(`${f.name}: exceeds ${MAX_FILE_MB} MB limit`);
          continue;
        }

        // Handle HEIC conversion
        if (isHeic) {
          try {
            const heic2any = (await import("heic2any")).default;
            const converted = await heic2any({
              blob: f,
              toType: "image/jpeg",
              quality: 0.8,
            });
            const blob = Array.isArray(converted) ? converted[0] : converted;
            f = new File([blob], f.name.replace(/\.heic$/i, ".jpg"), {
              type: "image/jpeg",
            });
          } catch (error) {
            errs.push(`${f.name}: failed to convert HEIC format`);
            continue;
          }
        }

        let pages = 1;
        if (f.type === "application/pdf") {
          try {
            const { PDFDocument } = await import("pdf-lib");
            const arrayBuffer = await f.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            pages = pdfDoc.getPageCount();
          } catch (e) {
            console.error("Failed to parse PDF pages for", f.name, e);
          }
        }

        newFiles.push({
          name: f.name,
          size: f.size,
          type: f.type,
          file: f,
          settings: {
            color: isColorActive,
            copies: 1,
            layout: 'portrait',
            pages: pages,
            doubleSided: false
          }
        });
      }

      setErrors(errs);
      onChange([...files, ...newFiles]);
      setIsProcessing(false);
    },
    [files, onChange, isColorActive]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    onChange(updated);
  };

  const setFileColor = (idx: number, color: boolean) => {
    const updated = [...files];
    const currSettings = updated[idx].settings || {
      color: false,
      copies: 1,
      layout: 'portrait',
      pages: 1,
      doubleSided: false,
    };
    if (currSettings.color === color) return;
    updated[idx].settings = {
      ...currSettings,
      color,
    };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* ── 2 Upload Tabs: Black & White vs Colour ── */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 dark:bg-muted/30 rounded-2xl border border-border/50">
        <button
          type="button"
          onClick={() => setActiveTab("bw")}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold text-xs transition-all",
            !isColorActive
              ? "bg-background text-foreground shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <span className="text-sm">📄</span>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 text-left">
            <span>Black &amp; White</span>
            <span className="text-[10px] font-medium text-muted-foreground">(₹{BW_RATE}/pg)</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("color")}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold text-xs transition-all",
            isColorActive
              ? "bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-indigo-500/10 text-rose-600 dark:text-rose-400 shadow-sm border border-rose-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <span className="text-sm">🎨</span>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 text-left">
            <span className={cn(isColorActive && "font-bold bg-gradient-to-r from-rose-500 to-amber-600 bg-clip-text text-transparent")}>
              Colour Print
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">(₹{COLOR_RATE}/pg)</span>
          </div>
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 cursor-pointer transition-all duration-200 select-none",
          dragging
            ? isColorActive
              ? "border-rose-500 bg-rose-500/10 scale-[1.01]"
              : "border-primary bg-primary/8 scale-[1.01]"
            : isColorActive
              ? "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/60 hover:bg-rose-500/10"
              : "border-border/60 bg-muted/30 hover:border-primary/50 hover:bg-primary/5"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => processFiles(e.target.files)}
        />
        <div
          className={cn(
            "p-3 rounded-full transition-colors",
            dragging
              ? isColorActive ? "bg-rose-500/20" : "bg-primary/20"
              : isColorActive ? "bg-rose-500/10" : "bg-muted/60"
          )}
        >
          {isProcessing ? (
            <Loader2 className={cn("h-6 w-6 animate-spin", isColorActive ? "text-rose-500" : "text-primary")} />
          ) : isColorActive ? (
            <Sparkles className="h-6 w-6 text-rose-500" />
          ) : (
            <Upload className={cn("h-6 w-6 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            {isProcessing
              ? "Processing files..."
              : dragging
              ? isColorActive ? "Drop Colour files here" : "Drop B&W files here"
              : isColorActive ? "Click or drag files for Colour Print" : "Click or drag files for Black & White"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            PDF, Word, JPEG, PNG, TXT — max {MAX_FILE_MB} MB each ·{" "}
            <span className="font-semibold text-foreground">
              {isColorActive ? `₹${COLOR_RATE}/page` : `₹${BW_RATE}/page`}
            </span>
          </p>
        </div>
      </div>

      {/* Error messages */}
      <AnimatePresence>
        {errors.map((err, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-destructive flex items-center gap-1.5 px-1"
          >
            <X className="h-3 w-3 shrink-0" /> {err}
          </motion.p>
        ))}
      </AnimatePresence>

      {/* Uploaded Files list */}
      <AnimatePresence>
        {files.map((f, idx) => {
          const Icon = fileIcon(f.type);
          const isColor = f.settings?.color || false;
          const pages = f.settings?.pages || 1;
          const copies = f.settings?.copies || 1;
          const rate = isColor ? COLOR_RATE : BW_RATE;
          const fileCost = pages * copies * rate;

          return (
            <motion.div
              key={f.name + idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={cn(
                "flex items-center gap-2.5 sm:gap-3 rounded-xl border px-3 sm:px-4 py-2.5 transition-colors",
                isColor
                  ? "bg-rose-500/[0.04] border-rose-500/20"
                  : "bg-card/60 border-border/50"
              )}
            >
              <div className={cn("p-1.5 rounded-lg shrink-0", isColor ? "bg-rose-500/10" : "bg-primary/10")}>
                <Icon className={cn("h-4 w-4", isColor ? "text-rose-500" : "text-primary")} />
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(f.size)} &bull; {pages} pg{pages !== 1 ? 's' : ''} &bull;{" "}
                  <span className="font-semibold text-foreground/80">₹{fileCost}</span>
                </p>
              </div>

              {/* Clean Segmented Color / B&W Toggle */}
              <div className="inline-flex items-center p-0.5 rounded-xl bg-muted/70 dark:bg-muted/40 border border-border/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setFileColor(idx, false)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    !isColor
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Switch to Black & White print"
                >
                  <span>📄 B&W</span>
                  <span className="text-[10px] font-mono opacity-60 font-normal">₹{BW_RATE}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFileColor(idx, true)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    isColor
                      ? "bg-rose-500 text-white shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Switch to Colour print"
                >
                  <span>🎨 Colour</span>
                  <span className={cn("text-[10px] font-mono font-normal", isColor ? "text-white/85" : "opacity-60")}>
                    ₹{COLOR_RATE}
                  </span>
                </button>
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

