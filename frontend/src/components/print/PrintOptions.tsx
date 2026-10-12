"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { PrintFile, calcFilesAmount, parsePageRange, BW_RATE, COLOR_RATE, MIN_JOB_AMOUNT } from "@/lib/printStore";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, FileText, FileImage, File as FileIcon, Settings, Info, Minus, Plus, Sparkles, CircleDot } from "lucide-react";
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

  const { bwPages, colorPages, totalPages, totalAmount } = calcFilesAmount(files);

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
          const rate = isColor ? COLOR_RATE : BW_RATE;
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
                  <div className={cn("p-1.5 rounded-lg shrink-0", isColor ? "bg-rose-500/10" : "bg-primary/10")}>
                    <Icon className={cn("h-4 w-4", isColor ? "text-rose-500" : "text-primary")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {pages} pg{pages !== 1 ? 's' : ''} &bull;{" "}
                      <span className="font-semibold text-foreground/80">₹{fileSubtotal}</span>
                    </p>
                  </div>
                </div>

                {/* Copies Stepper */}
                <div className="flex items-center gap-1.5 shrink-0 bg-background/50 rounded-lg p-1 border border-border/40">
                  <button
                    type="button"
                    onClick={() => updateCopies(idx, -1)}
                    className="p-1 rounded bg-background shadow-xs hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors cursor-pointer"
                    disabled={(f.settings?.copies || 1) <= 1}
                    title="Decrease copies"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-xs font-semibold w-5 text-center font-mono">{f.settings?.copies || 1}</span>
                  <button
                    type="button"
                    onClick={() => updateCopies(idx, 1)}
                    className="p-1 rounded bg-background shadow-xs hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                    title="Increase copies"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Controls Row: B&W / Colour Segmented Pill + Duplex */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                {/* Clean Segmented Color / B&W Toggle */}
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
                    <span>📄 B&W</span>
                    <span className="text-[10px] font-mono opacity-60 font-normal">₹{BW_RATE}</span>
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
                    <span>🎨 Colour</span>
                    <span className={cn("text-[10px] font-mono font-normal", isColor ? "text-white/85" : "opacity-60")}>
                      ₹{COLOR_RATE}
                    </span>
                  </button>
                </div>

                {/* Duplex Toggle */}
                <div
                  className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => toggleDoubleSided(idx)}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-foreground">Double-sided</span>
                    <div className="relative group flex items-center">
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      <div className="absolute bottom-full mb-2 right-0 w-44 p-2 bg-card border border-border text-foreground text-[10px] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        Prints on both sides to save paper.
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out",
                    isDoubleSided ? "bg-primary" : "bg-muted-foreground/30"
                  )}>
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out",
                      isDoubleSided ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Live Total Cost Summary */}
      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-foreground/80">Total Pages</p>
          <p className="text-[11px] text-muted-foreground">
            {totalPages} page{totalPages !== 1 ? 's' : ''} ({bwPages} B&amp;W, {colorPages} Colour)
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-foreground/80">Total Amount</p>
          <p className="font-bold text-lg text-primary">₹{totalAmount}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="pt-2 pb-2 flex gap-3">
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
          className="flex-1 rounded-xl h-12 text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
        >
          Continue to Preview
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
