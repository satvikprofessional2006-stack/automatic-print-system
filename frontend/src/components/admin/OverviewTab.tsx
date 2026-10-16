"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Printer,
  Droplet,
  RefreshCw,
  CheckCircle2,
  Clock,
  IndianRupee,
  ArrowRight,
  AlertTriangle,
  Zap,
  Activity,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Supply {
  name: string;
  level: number;
  color: string;
  type: string;
  isLow: boolean;
}

interface ConnectedPrinterInfo {
  id: string;
  name: string;
  state: "idle" | "printing" | "standby" | "offline";
  statusText: string;
  isOnline: boolean;
  supplies: Supply[];
}

interface OverviewTabProps {
  onNavigate: (tabId: string) => void;
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const { user, logout } = useAuth();
  const [printer, setPrinter] = useState<ConnectedPrinterInfo | null>(null);
  const [loadingPrinter, setLoadingPrinter] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Fetch dynamically detected connected printer
  const fetchPrinterStatus = async () => {
    setLoadingPrinter(true);
    try {
      const res = await fetch("/api/admin/printer-status", {
        headers: { Authorization: `Bearer ${user?.password || "admin"}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setPrinter(data.connectedPrinter || null);
      }
    } catch (e) {
      console.error("Failed to fetch printer status:", e);
    } finally {
      setLoadingPrinter(false);
    }
  };

  // Fetch recent jobs for stats & activity stream
  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch("/api/admin/jobs", {
        headers: { Authorization: `Bearer ${user?.password || "admin"}` },
        cache: "no-store",
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error("Failed to fetch jobs for overview:", e);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchPrinterStatus();
    fetchJobs();

    // Poll printer status every 15 seconds
    const interval = setInterval(() => {
      fetchPrinterStatus();
      fetchJobs();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Aggregate stats from jobs
  const metrics = useMemo(() => {
    const totalJobs = jobs.length;
    const completed = jobs.filter((j) => j.status === "completed" || j.status === "paid").length;
    const queued = jobs.filter((j) => j.status === "queued" || j.status === "printing").length;
    const failed = jobs.filter((j) => j.status === "failed").length;

    const totalRevenue = jobs
      .filter((j) => j.status === "completed" || j.status === "paid")
      .reduce((sum, j) => sum + (j.amount || (j.copies || 1) * (j.color ? 10 : 2)), 0);

    const totalPages = jobs
      .filter((j) => j.status === "completed" || j.status === "paid")
      .reduce((sum, j) => sum + (j.copies || 1), 0);

    const successRate = totalJobs > 0 ? ((completed / totalJobs) * 100).toFixed(1) : "100";

    return {
      totalJobs,
      completed,
      queued,
      failed,
      totalRevenue,
      totalPages,
      successRate,
    };
  }, [jobs]);

  const recentJobs = useMemo(() => {
    return jobs.slice(0, 6);
  }, [jobs]);

  const getTonerProgressColor = (colorHex: string, level: number) => {
    if (level <= 15) return "bg-rose-500 shadow-rose-500/30";
    const cleanHex = colorHex.toLowerCase();
    if (cleanHex.includes("00ffff") || cleanHex.includes("cyan")) return "bg-cyan-500 shadow-cyan-500/30";
    if (cleanHex.includes("ff00ff") || cleanHex.includes("magenta")) return "bg-pink-500 shadow-pink-500/30";
    if (cleanHex.includes("ffff00") || cleanHex.includes("yellow")) return "bg-amber-400 shadow-amber-400/30";
    return "bg-zinc-400 dark:bg-zinc-200 shadow-zinc-500/20";
  };

  const getTonerBorderColor = (colorHex: string, isLow: boolean) => {
    if (isLow) return "border-rose-500/40 bg-rose-500/5";
    const cleanHex = colorHex.toLowerCase();
    if (cleanHex.includes("00ffff") || cleanHex.includes("cyan")) return "border-cyan-500/30 bg-cyan-500/5";
    if (cleanHex.includes("ff00ff") || cleanHex.includes("magenta")) return "border-pink-500/30 bg-pink-500/5";
    if (cleanHex.includes("ffff00") || cleanHex.includes("yellow")) return "border-amber-500/30 bg-amber-500/5";
    return "border-zinc-500/30 bg-zinc-500/5";
  };

  return (
    <div className="flex flex-col h-full space-y-5 overflow-y-auto pr-1 pb-8 min-h-0">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Overview Command Center</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time connected printer hardware supplies, active queues, and print operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchPrinterStatus();
              fetchJobs();
            }}
            disabled={loadingPrinter || loadingJobs}
            className="h-9 gap-1.5 text-xs rounded-xl bg-card/60 hover:bg-card border-border/70 text-foreground cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (loadingPrinter || loadingJobs) && "animate-spin")} />
            Sync Hardware
          </Button>
        </div>
      </div>

      {/* ── Section 1: Live Connected Printer & Toner Gauge (Only Connected Printer) ── */}
      <Card className="border border-border/50 bg-gradient-to-br from-card/80 via-card/50 to-card/30 backdrop-blur-xl rounded-2xl shadow-sm overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-5">
          {/* Top row: Connected Printer Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                <Printer className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    {printer?.name || "Detecting Connected Printer..."}
                  </h3>
                  <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-semibold">
                    Connected Active Printer
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>Connection: CUPS Direct / IPP</span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Local Spooler Active</span>
                </p>
              </div>
            </div>

            {/* Hardware Status Badge */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border",
                  printer?.state === "printing"
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 animate-pulse"
                    : printer?.supplies.some((s) => s.isLow)
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    printer?.state === "printing"
                      ? "bg-blue-500 animate-ping"
                      : printer?.supplies.some((s) => s.isLow)
                      ? "bg-amber-500"
                      : "bg-emerald-500 animate-pulse"
                  )}
                />
                <span>{printer?.statusText || "Ready & Spooling"}</span>
              </div>
            </div>
          </div>

          {/* Toner & Ink Level Gauges */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Droplet className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Live Toner / Ink Telemetry
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                Hardware query via IPP
              </span>
            </div>

            {printer?.supplies && printer.supplies.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {printer.supplies.map((supply, idx) => {
                  const progressColor = getTonerProgressColor(supply.color, supply.level);
                  const borderColor = getTonerBorderColor(supply.color, supply.isLow);

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-xl border p-3.5 space-y-2.5 transition-all relative overflow-hidden",
                        borderColor
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-3 w-3 rounded-full shrink-0 border border-black/20 shadow-xs"
                            style={{ backgroundColor: supply.color }}
                          />
                          <span className="text-xs font-bold text-foreground truncate" title={supply.name}>
                            {supply.name}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-extrabold text-foreground">
                          {supply.level}%
                        </span>
                      </div>

                      {/* Progress meter */}
                      <div className="h-2.5 w-full bg-muted/60 dark:bg-muted/40 rounded-full overflow-hidden p-0.5 border border-border/30">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${supply.level}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={cn("h-full rounded-full transition-all shadow-sm", progressColor)}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="truncate">{supply.name}</span>
                        {supply.isLow ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                            <AlertTriangle className="h-3 w-3" /> Low Toner Alert
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Optimal</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/20 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Printer hardware ready • No supply warnings reported</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Core Metrics (4 Cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Batches */}
        <Card className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Printer className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                Total Jobs
              </p>
              <p className="text-2xl font-extrabold font-mono text-foreground tracking-tight mt-0.5">
                {metrics.totalJobs}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                All time print batches
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Completed & Success Rate */}
        <Card className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                Success Rate
              </p>
              <p className="text-2xl font-extrabold font-mono text-foreground tracking-tight mt-0.5">
                {metrics.successRate}%
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 truncate">
                {metrics.completed} successful prints
              </p>
            </div>
          </CardContent>
        </Card>

        {/* In Queue */}
        <Card className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                Active Queue
              </p>
              <p className="text-2xl font-extrabold font-mono text-foreground tracking-tight mt-0.5">
                {metrics.queued}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {metrics.queued === 0 ? "Queue clear & idle" : "Spooling to hardware"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                Total Revenue
              </p>
              <p className="text-2xl font-extrabold font-mono text-foreground tracking-tight mt-0.5">
                ₹{metrics.totalRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {metrics.totalPages} pages billed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 3: Quick Action Launchpad ── */}
      <Card className="border border-border/40 bg-card/30 backdrop-blur-md rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Quick Action Launchpad
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground">Direct shortcuts</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onNavigate("admin-print")}
            className="flex items-center justify-between p-3.5 rounded-xl bg-card/70 hover:bg-card border border-border/60 hover:border-primary/40 transition-all text-left cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Printer className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Direct Admin Print</p>
                <p className="text-[10px] text-muted-foreground">Print official circulars &amp; bypass UPI</p>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          <button
            onClick={() => onNavigate("logs")}
            className="flex items-center justify-between p-3.5 rounded-xl bg-card/70 hover:bg-card border border-border/60 hover:border-primary/40 transition-all text-left cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Live Print Queue</p>
                <p className="text-[10px] text-muted-foreground">Inspect active jobs &amp; reprint</p>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          <button
            onClick={() => onNavigate("revenue")}
            className="flex items-center justify-between p-3.5 rounded-xl bg-card/70 hover:bg-card border border-border/60 hover:border-primary/40 transition-all text-left cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Register Logbook</p>
                <p className="text-[10px] text-muted-foreground">University 12-col audit &amp; CSV export</p>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        </div>
      </Card>

      {/* ── Section 4: Live Activity Stream (Recent Jobs) ── */}
      <Card className="border border-border/40 bg-card/30 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Recent Spool Activity
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("logs")}
            className="h-7 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
          >
            View All in Print Logs
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {recentJobs.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No print jobs recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recentJobs.map((job) => {
              const isPaidOrCompleted = job.status === "completed" || job.status === "paid";
              const isFailed = job.status === "failed";
              const isPrinting = job.status === "printing";

              return (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card/60 hover:bg-card border border-border/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {(job.userName || "S")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                          {job.userName || "Student"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          • {job.copies || 1} {job.copies === 1 ? "page" : "pages"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                        {job.filename || "document.pdf"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {job.color ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        Colour
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-foreground/70 border border-border/50">
                        B&amp;W
                      </span>
                    )}

                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize font-medium",
                        isPaidOrCompleted && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        isPrinting && "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse",
                        isFailed && "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {job.status === "completed" ? "Done" : job.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
