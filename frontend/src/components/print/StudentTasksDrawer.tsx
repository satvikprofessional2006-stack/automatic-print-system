"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  RotateCw,
  FileText,
  Clock,
  Building2,
  CheckCircle2,
  Printer,
  Ban,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StudentTaskItem {
  id: string;
  taskDisplayId: string;
  createdAt: string;
  status: "paid" | "queued" | "printing" | "completed" | "cancelled" | "failed";
  amount: number;
  totalPages: number;
  files: {
    id: string;
    filename: string;
    copies: number;
    color: boolean;
    paperSize: string;
    status: string;
  }[];
}

interface StudentTasksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: StudentTaskItem[];
  loading?: boolean;
  onRefresh?: () => void;
  studentName?: string;
}

export function StudentTasksDrawer({
  isOpen,
  onClose,
  tasks,
  loading = false,
  onRefresh,
  studentName,
}: StudentTasksDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: StudentTaskItem["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            Printed / Completed
          </span>
        );
      case "printing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            <Printer className="h-3 w-3 animate-pulse" />
            Printing Now
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30">
            <Ban className="h-3 w-3" />
            Cancelled & Refunded
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-500/30">
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        );
      case "paid":
      case "queued":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <Clock className="h-3 w-3" />
            Ready at Counter
          </span>
        );
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="relative z-10 w-full sm:max-w-md bg-background border-t sm:border-l sm:border-t-0 border-border shadow-2xl rounded-t-3xl sm:rounded-l-3xl sm:rounded-tr-none max-h-[85vh] sm:h-full flex flex-col overflow-hidden"
          >
            {/* Grab Handle for mobile */}
            <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto mt-2.5 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">Today's Tasks</h3>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
                      {tasks.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {studentName ? `${studentName.split(" ")[0]}'s recent prints` : "Your recent prints today"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {onRefresh && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    disabled={loading}
                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Refresh status"
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Collection Point Banner */}
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2.5 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
              <Building2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="leading-tight">
                <span className="font-bold">Collection Counter:</span> Ashok Goel Library (Ground Floor)
              </div>
            </div>

            {/* Tasks List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                    <FileText className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No print tasks yet today</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Whenever you print a document, its Task ID and real-time status will appear here so you never lose it.
                  </p>
                </div>
              ) : (
                tasks.map((task) => {
                  const isCopied = copiedId === task.taskDisplayId;

                  return (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-border/80 bg-card/60 p-3.5 space-y-2.5 shadow-xs hover:border-primary/40 transition-all"
                    >
                      {/* Top: Task ID + Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-foreground bg-muted/70 px-2 py-0.5 rounded-lg border border-border/60 select-all">
                            {task.taskDisplayId}
                          </span>
                          <button
                            onClick={(e) => handleCopy(task.taskDisplayId, e)}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Copy Task ID"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {getStatusBadge(task.status)}
                      </div>

                      {/* File Details */}
                      <div className="space-y-1 bg-background/50 rounded-xl p-2 border border-border/40 text-xs">
                        {task.files.map((file, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="truncate max-w-[200px] text-foreground font-medium text-[11px]">
                                {file.filename}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                              {file.copies} copy · {file.color ? "Color" : "B&W"}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Footer: Amount, Pages, Time */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">₹{task.amount}</span>
                          <span>·</span>
                          <span>{task.totalPages} {task.totalPages === 1 ? "page" : "pages"}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground/80">
                          {formatTime(task.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer instruction note */}
            <div className="p-3 bg-muted/30 border-t border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <HelpCircle className="h-3 w-3 text-muted-foreground" />
                Show any Task ID to the operator at the print station.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
