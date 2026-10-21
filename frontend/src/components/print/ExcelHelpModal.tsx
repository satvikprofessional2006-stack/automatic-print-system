"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileSpreadsheet, ArrowRight, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExcelHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attemptedFileName?: string | null;
}

export function ExcelHelpModal({
  open,
  onOpenChange,
  attemptedFileName,
}: ExcelHelpModalProps) {
  const [activeTab, setActiveTab] = useState<"excel" | "sheets">("excel");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-5 gap-4 border border-border/80 bg-card rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/25">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base font-bold text-foreground leading-tight">
              Export Spreadsheet as PDF to Print
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Direct Excel printing splits tables in half across pages
            </p>
          </div>
        </div>

        {/* Detected File Chip */}
        {attemptedFileName && (
          <div className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border/60 flex items-center gap-2 text-xs font-mono text-foreground/80 truncate">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded shrink-0">
              Detected
            </span>
            <span className="truncate">{attemptedFileName}</span>
          </div>
        )}

        {/* App Switcher */}
        <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl border border-border/50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("excel")}
            className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              activeTab === "excel"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Microsoft Excel
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sheets")}
            className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              activeTab === "sheets"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Google Sheets
          </button>
        </div>

        {/* Elaborated Step-by-Step Guide */}
        {activeTab === "excel" ? (
          <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                1
              </span>
              <p className="text-foreground leading-relaxed">
                Open your document and go to <span className="font-semibold text-foreground">File → Save As</span> (or <span className="font-semibold text-foreground">Export</span>).
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                2
              </span>
              <p className="text-foreground leading-relaxed">
                Choose <span className="font-semibold text-emerald-600 dark:text-emerald-400">PDF (*.pdf)</span> from the format dropdown.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                3
              </span>
              <p className="text-foreground leading-relaxed">
                Under print options / scaling, select <span className="font-semibold text-emerald-600 dark:text-emerald-400">"Fit All Columns on One Page"</span> so table columns aren't cut in half.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                4
              </span>
              <p className="text-foreground leading-relaxed">
                Save the file and upload the resulting <span className="font-semibold font-mono text-foreground">.pdf</span> here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                1
              </span>
              <p className="text-foreground leading-relaxed">
                In Google Sheets, click <span className="font-semibold text-foreground">File → Download → PDF document (.pdf)</span>.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                2
              </span>
              <p className="text-foreground leading-relaxed">
                In the print preview settings, set Page Orientation to <span className="font-semibold text-foreground">Landscape</span> if your table has many columns.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                3
              </span>
              <p className="text-foreground leading-relaxed">
                Under Scale, choose <span className="font-semibold text-emerald-600 dark:text-emerald-400">"Fit to width"</span> and click the blue <span className="font-semibold text-foreground">Export</span> button at the top-right.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                4
              </span>
              <p className="text-foreground leading-relaxed">
                Drop your downloaded <span className="font-semibold font-mono text-foreground">.pdf</span> here to print immediately.
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 text-xs cursor-pointer"
        >
          <span>Got it, I'll export as PDF</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
