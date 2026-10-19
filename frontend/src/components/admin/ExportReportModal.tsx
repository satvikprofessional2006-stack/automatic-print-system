import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, BookOpen, ReceiptText, FileSpreadsheet, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Transaction } from "./RevenueTab";

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTransactions: Transaction[];
  initialFormat?: "register" | "audit";
}

type DatePreset = "all" | "this_month" | "7days" | "today" | "custom";
type ReportFormat = "register" | "audit";

function toLocalDateKey(d: Date): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffsetMs);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ExportReportModal({
  isOpen,
  onClose,
  allTransactions,
  initialFormat = "register",
}: ExportReportModalProps) {
  const [reportFormat, setReportFormat] = useState<ReportFormat>(initialFormat);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [paidOnly, setPaidOnly] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const resetFilters = React.useCallback(() => {
    setReportFormat(initialFormat);
    setDatePreset("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setPaidOnly(true);
    setIsExporting(false);
  }, [initialFormat]);

  const handleClose = () => {
    resetFilters();
    onClose();
  };

  // Reset all filters every time the modal opens
  useEffect(() => {
    if (isOpen) {
      resetFilters();
    }
  }, [isOpen, resetFilters]);

  // Compute filtered dataset
  const filtered = useMemo(() => {
    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const currentYearMonth = todayKey.slice(0, 7);

    return allTransactions.filter((t) => {
      // Register Logbook is by definition strictly completed, paid print jobs
      if (reportFormat === "register") {
        if (t.status !== "completed" && t.status !== "paid") return false;
      } else {
        // Transactions audit can optionally include or exclude cancelled attempts
        if (paidOnly && t.status !== "completed" && t.status !== "paid") return false;
      }

      if (datePreset === "today") return t.dateKey === todayKey;
      if (datePreset === "7days") {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        return t.dateKey >= toLocalDateKey(d);
      }
      if (datePreset === "this_month") return t.dateKey.startsWith(currentYearMonth);
      if (datePreset === "custom") {
        if (customStartDate && t.dateKey < customStartDate) return false;
        if (customEndDate && t.dateKey > customEndDate) return false;
      }
      return true;
    });
  }, [allTransactions, datePreset, customStartDate, customEndDate, paidOnly, reportFormat]);

  const totalRevenue = useMemo(() => {
    return filtered.reduce((acc, t) => {
      return acc + (t.status === "completed" || t.status === "paid" ? t.amount || 0 : 0);
    }, 0);
  }, [filtered]);

  const handleDownloadCSV = () => {
    if (filtered.length === 0) return;
    setIsExporting(true);

    try {
      let headers: string[] = [];
      let rows: (string | number)[][] = [];

      if (reportFormat === "register") {
        const sorted = [...filtered].sort(
          (a, b) => (a.registerSeqNumber || a.seqNumber) - (b.registerSeqNumber || b.seqNumber)
        );

        headers = [
          "S. No.",
          "Date",
          "Name",
          "Course",
          "UTR No.",
          "Page Size",
          "Colour Print",
          "Colour Page",
          "B&W Print",
          "B&W Page",
          "Total Pages",
          "Amount",
        ];

        rows = sorted.map((t, idx) => {
          const d = new Date(t.createdAt);
          const dateFormatted = `${String(d.getDate()).padStart(2, "0")}-${String(
            d.getMonth() + 1
          ).padStart(2, "0")}-${String(d.getFullYear()).slice(-2)}`;
          const hasColor = (t.colorPages || 0) > 0;
          const hasBw = (t.bwPages || 0) > 0;

          return [
            t.registerSeqNumber || idx + 1,
            `"${dateFormatted}"`,
            `"${(t.name || "").replace(/"/g, '""')}"`,
            `"${t.course || "CSDS"}"`,
            `"${t.utrNo || ""}"`,
            `"${t.pageSize || "A4"}"`,
            hasColor ? 1 : '"-"',
            hasColor ? t.colorPages || 0 : '"-"',
            hasBw ? 1 : '"-"',
            hasBw ? t.bwPages || 0 : '"-"',
            t.totalPages || 0,
            `"₹${t.amount || 0}"`,
          ];
        });
      } else {
        const sorted = [...filtered].sort((a, b) => a.seqNumber - b.seqNumber);

        headers = [
          "Task ID",
          "Date & Time",
          "Customer Name",
          "User Type",
          "Course",
          "Payment Ref",
          "UTR No.",
          "Page Size",
          "Colour Pages",
          "B&W Pages",
          "Total Pages",
          "Status",
          "Amount",
        ];

        rows = sorted.map((t) => {
          const d = new Date(t.createdAt);
          const timeFormatted = `${String(d.getDate()).padStart(2, "0")}-${String(
            d.getMonth() + 1
          ).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(
            d.getMinutes()
          ).padStart(2, "0")}`;

          return [
            `"${t.internalId || t.id}"`,
            `"${timeFormatted}"`,
            `"${(t.name || "").replace(/"/g, '""')}"`,
            `"${t.userType || "Student"}"`,
            `"${t.course || "CSDS"}"`,
            `"${t.id}"`,
            `"${t.utrNo || ""}"`,
            `"${t.pageSize || "A4"}"`,
            t.colorPages || 0,
            t.bwPages || 0,
            t.totalPages || 0,
            `"${t.status.toUpperCase()}"`,
            `"₹${t.amount || 0}"`,
          ];
        });
      }

      const csvContent =
        "data:text/csv;charset=utf-8,\uFEFF" +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);

      const todayStr = toLocalDateKey(new Date());
      const formatSlug = reportFormat === "register" ? "register" : "transactions";
      const fileName = `ru_print_${formatSlug}_${datePreset}_${todayStr}.csv`;

      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        handleClose();
      }, 300);
    } catch (err) {
      console.error("Export failed:", err);
      setIsExporting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-w-md bg-card border border-border/80 shadow-2xl rounded-2xl p-5 gap-4">
        {/* Header */}
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground border border-border/60">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Export CSV Report
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Choose format and date range to download.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 text-xs">
          {/* 1. Format Switcher (Unified Segmented Control) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Report Format
            </span>
            <div className="grid grid-cols-2 p-1 bg-muted/40 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setReportFormat("register")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
                  reportFormat === "register"
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Register Logbook</span>
              </button>

              <button
                type="button"
                onClick={() => setReportFormat("audit")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
                  reportFormat === "audit"
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ReceiptText className="h-3.5 w-3.5" />
                <span>Transactions Audit</span>
              </button>
            </div>
          </div>

          {/* 2. Date Range (Matching Unified Segmented Control) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Date Range
            </span>
            <div className="flex flex-wrap gap-1 p-1 bg-muted/40 rounded-xl border border-border/50">
              {(
                [
                  { id: "all", label: "All Time" },
                  { id: "this_month", label: "This Month" },
                  { id: "7days", label: "Last 7 Days" },
                  { id: "today", label: "Today" },
                  { id: "custom", label: "Custom" },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDatePreset(preset.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer select-none",
                    datePreset === preset.id
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {datePreset === "custom" && (
              <div className="flex items-center gap-2 pt-1 animate-in fade-in-50 duration-150">
                <div className="flex items-center gap-1.5 bg-muted/30 border border-border/60 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground font-medium text-[11px]">From:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-transparent border-none text-foreground font-mono text-xs focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-muted/30 border border-border/60 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground font-medium text-[11px]">To:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-transparent border-none text-foreground font-mono text-xs focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Scope Segmented Toggle (Only for Transactions Audit) */}
          {reportFormat === "audit" && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-150">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Records Included
              </span>
              <div className="grid grid-cols-2 p-1 bg-muted/40 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setPaidOnly(true)}
                  className={cn(
                    "py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none text-center",
                    paidOnly
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Paid Orders Only
                </button>
                <button
                  type="button"
                  onClick={() => setPaidOnly(false)}
                  className={cn(
                    "py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none text-center",
                    !paidOnly
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Attempts (Incl. Cancelled)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between pt-3 border-t border-border/60 mt-1">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> records ·{" "}
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              ₹{totalRevenue}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 rounded-lg text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDownloadCSV}
              disabled={filtered.length === 0 || isExporting}
              className="h-8 rounded-lg text-xs gap-1.5 bg-primary text-primary-foreground font-semibold px-3.5 hover:bg-primary/90 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
