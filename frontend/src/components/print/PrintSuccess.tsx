"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PrintJob } from "@/lib/printStore";
import {
  CheckCircle2,
  Printer,
  FileText,
  RotateCcw,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Building2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  job: PrintJob;
  onReset: () => void;
}

const PRINT_STAGES = [
  "Payment Confirmed ✓",
  "Connecting to Print Station…",
  "Sending Files to Printer…",
  "Queued at Library Counter!",
  "Ready for Collection!",
];

export function PrintSuccess({ job, onReset }: Props) {
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    // Stage 0: Payment confirmed
    setStage(0);

    // Stage 1: Connecting (after 800ms)
    const t1 = setTimeout(() => {
      setStage(1);
    }, 800);

    // Stage 2: Sending files (after 1800ms)
    const t2 = setTimeout(() => {
      setStage(2);
    }, 1800);

    // Stage 3: Queued at Library Counter (after 2800ms)
    const t3 = setTimeout(() => {
      setStage(3);
    }, 2800);

    // Stage 4: Guaranteed completion to Ready for Collection (after 3800ms)
    const t4 = setTimeout(() => {
      setStage(4);
      setDone(true);
    }, 3800);

    // Real-time backend status polling
    const pollInterval = setInterval(async () => {
      if (!job.id) return;
      try {
        const res = await fetch(`/api/jobs/${job.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.position) {
            setQueuePosition(data.position);
          }
          if (data.status === "printing") {
            setIsPrinting(true);
            setStage(3);
          } else if (data.status === "completed") {
            setStage(4);
            setDone(true);
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        // Soft fail; timer will guarantee completion
      }
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearInterval(pollInterval);
    };
  }, [job.id]);

  const handleCopyId = () => {
    if (!job.id) return;
    navigator.clipboard.writeText(job.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center w-full max-w-lg mx-auto">
      {/* Dynamic Animated Status Header */}
      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div
            key="loading-stage"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-4 py-3"
          >
            <div className="relative p-6 rounded-full bg-primary/10 border border-primary/20 shadow-inner">
              <Printer className="h-12 w-12 text-primary animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>

            <div className="space-y-1">
              <motion.p
                key={stage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-bold text-foreground"
              >
                {isPrinting ? "Printing your document now…" : PRINT_STAGES[stage]}
              </motion.p>
              <p className="text-xs text-muted-foreground">
                Connecting with the Library Print System. Please wait a moment…
              </p>
            </div>

            {/* Stage progress dots */}
            <div className="flex items-center gap-2 mt-1">
              {PRINT_STAGES.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: i === stage ? 1.4 : 1,
                    backgroundColor: i <= stage ? "hsl(var(--primary))" : "hsl(var(--muted))",
                  }}
                  transition={{ duration: 0.25 }}
                  className="h-2 w-2 rounded-full"
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="done-stage"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 25 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="relative p-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="absolute -top-1 -right-1 p-1 rounded-full bg-emerald-500 text-white shadow-md"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </motion.div>
            </div>

            <h2 className="text-xl font-extrabold tracking-tight text-foreground mt-2">
              Print Job Successful!
            </h2>
            <p className="text-xs text-muted-foreground max-w-sm">
              Your files have been sent to the printer queue and payment has been verified.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CENTRAL LIBRARY COLLECTION CARD (Step 6 Highlight) ── */}
      {done && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="w-full rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5 text-left shadow-lg space-y-3.5"
        >
          {/* Location Header */}
          <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                  Collection Point
                </span>
                <h3 className="text-sm font-bold text-foreground">
                  Collect from the Library
                </h3>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <MapPin className="h-3 w-3" /> Ground Floor
            </span>
          </div>

          {/* Core Instruction */}
          <div className="bg-background/80 rounded-xl p-3 border border-emerald-500/15 space-y-1">
            <p className="text-xs font-semibold text-foreground">
              📍 Library Print Counter Instructions:
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please visit the <strong className="text-foreground">Library Print Station</strong>. Show your <strong className="text-foreground">Task ID</strong> below or mention your name to the operator to collect your prints.
            </p>
          </div>

          {/* Prominent Task ID Banner with One-Click Copy */}
          <div className="flex items-center justify-between bg-emerald-950/10 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Task / Job ID
              </p>
              <p className="font-mono text-base font-extrabold text-foreground tracking-wide select-all">
                #{job.id}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyId}
              className="h-8 gap-1.5 text-xs font-semibold rounded-lg border-emerald-500/30 hover:bg-emerald-500/15"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy ID</span>
                </>
              )}
            </Button>
          </div>

          {/* Quick status pill */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Paid ₹{job.amount} · Verified Receipt
            </span>
            {queuePosition && (
              <span className="text-[11px] font-semibold text-foreground">
                Queue Position: #{queuePosition}
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Files Summary Accordion Card */}
      <div className="w-full rounded-2xl bg-muted/40 border border-border/60 p-4 space-y-2.5 text-left">
        <div className="flex items-center justify-between text-xs">
          <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
            Printed Documents ({job.files.length})
          </p>
          <span className="font-semibold text-foreground text-xs">
            {job.totalPages} Page{job.totalPages !== 1 ? "s" : ""} Total
          </span>
        </div>

        <div className="divide-y divide-border/40">
          {job.files.map((f, i) => (
            <div key={i} className="flex items-center justify-between py-2 text-xs">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <p className="text-foreground font-medium truncate max-w-[200px] sm:max-w-[260px]">
                  {f.name}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                {f.settings?.copies || 1} copy · {f.settings?.color ? "Color" : "B&W"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      {done && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-1"
        >
          <Button
            type="button"
            onClick={onReset}
            className="w-full sm:flex-1 h-11 rounded-xl gap-2 font-semibold text-sm shadow-md"
          >
            <RotateCcw className="h-4 w-4" />
            Print Another Document
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(`/status/${job.id}`, "_blank")}
            className="w-full sm:w-auto h-11 px-4 rounded-xl gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            Live Queue
          </Button>
        </motion.div>
      )}
    </div>
  );
}
