"use client";

import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, FileImage, File as FileIcon, Plus, Minus } from "lucide-react";
import { PrintFile } from "@/lib/printStore";
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
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateCopies = (index: number, delta: number) => {
    const newFiles = [...files];
    const currentSettings = newFiles[index].settings || { color: false, copies: 1, layout: 'portrait', pages: 1 };
    const newCopies = Math.max(1, currentSettings.copies + delta);
    newFiles[index].settings = { ...currentSettings, copies: newCopies };
    onChange(newFiles);
  };

  const updateAllCopies = (delta: number) => {
    const newFiles = [...files];
    let allUpdated = false;
    for (let i = 0; i < newFiles.length; i++) {
      const currentSettings = newFiles[i].settings || { color: false, copies: 1, layout: 'portrait', pages: 1 };
      const newCopies = Math.max(1, currentSettings.copies + delta);
      if (newCopies !== currentSettings.copies) allUpdated = true;
      newFiles[i].settings = { ...currentSettings, copies: newCopies };
    }
    if (allUpdated) onChange(newFiles);
  };

  const processFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
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
            color: false,
            copies: 1,
            layout: 'portrait',
            pages: pages
          }
        });
      }

      setErrors(errs);
      onChange([...files, ...newFiles]);
    },
    [files, onChange]
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

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 cursor-pointer transition-all duration-200 select-none",
          dragging
            ? "border-primary bg-primary/8 scale-[1.01]"
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
        <div className={cn("p-3 rounded-full transition-colors", dragging ? "bg-primary/20" : "bg-muted/60")}>
          <Upload className={cn("h-6 w-6 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            {dragging ? "Drop files here" : "Click or drag files here"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            PDF, Word, JPEG, PNG, TXT — max {MAX_FILE_MB} MB each
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

      {/* Global Copies Control */}
      {files.length > 1 && (
        <div className="flex items-center justify-between bg-primary/5 rounded-xl px-4 py-2 border border-primary/10">
          <span className="text-xs font-semibold text-primary">Apply to all files</span>
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
      )}

      {/* File list */}
      <AnimatePresence>
        {files.map((f, idx) => {
          const Icon = fileIcon(f.type);
          return (
            <motion.div
              key={f.name + idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="flex items-center gap-3 rounded-xl bg-card/60 border border-border/50 px-4 py-2"
            >
              <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(f.size)} &bull; {f.settings?.pages || 1} pg{(f.settings?.pages || 1) !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Copies Stepper */}
              <div className="flex items-center gap-1.5 shrink-0 bg-background/50 rounded-lg p-1 border border-border/40 mr-1">
                <button
                  type="button"
                  onClick={() => updateCopies(idx, -1)}
                  className="p-1 rounded bg-background shadow-sm hover:bg-muted text-muted-foreground disabled:opacity-50 transition-colors"
                  disabled={(f.settings?.copies || 1) <= 1}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-xs font-semibold w-4 text-center">{f.settings?.copies || 1}</span>
                <button
                  type="button"
                  onClick={() => updateCopies(idx, 1)}
                  className="p-1 rounded bg-background shadow-sm hover:bg-muted text-muted-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" />
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
