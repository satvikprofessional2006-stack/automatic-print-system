"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobStatus } from "@/lib/printStore";
import {
  Search,
  RefreshCw,
  GraduationCap,
  User2,
  FileText,
  Folder,
  ChevronDown,
  ChevronUp,
  Printer,
} from "lucide-react";
import { cn, formatIndianDateTime, parseUtcDate } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-blue-500/15 text-blue-800 dark:text-blue-200 border border-blue-500/30",
  pending_payment:
    "bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/40",
  paid: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30",
  printing:
    "bg-violet-500/15 text-violet-800 dark:text-violet-200 border border-violet-500/30",
  completed: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30",
  failed: "bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-800 dark:text-zinc-300 border border-zinc-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "In Queue",
  pending_payment: "Pending Payment",
  paid: "Awaiting Release",
  printing: "Printing",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

function formatTime(iso: string) {
  return formatIndianDateTime(iso);
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function PrintJobsTable() {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [printerLastSeen, setPrinterLastSeen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const load = async () => {
    if (!user?.password) return;
    try {
      const res = await fetch('/api/admin/jobs', {
        headers: { 'Authorization': `Bearer ${user.password}` },
        cache: 'no-store'
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        console.warn('Admin jobs polling failed with status:', res.status);
        return;
      }
      const data = await res.json();
      const rawJobs = data.jobs || [];
      const processedJobs: any[][] = [];
      
      for (const job of rawJobs) {
        // Try to find an existing group for this user that is within 60 seconds of this job
        const existingGroupIndex = processedJobs.findIndex(group => {
          const firstInGroup = group[0];
          const lastInGroup = group[group.length - 1];
          if (firstInGroup.userName !== job.userName) return false;
          
          // Check if the job's time is within 60 seconds of either the first or last job in the group
          const timeDiffFirst = Math.abs(parseUtcDate(firstInGroup.createdAt).getTime() - parseUtcDate(job.createdAt).getTime());
          const timeDiffLast = Math.abs(parseUtcDate(lastInGroup.createdAt).getTime() - parseUtcDate(job.createdAt).getTime());
          
          return timeDiffFirst <= 60000 || timeDiffLast <= 60000;
        });

        if (existingGroupIndex !== -1) {
          processedJobs[existingGroupIndex].push(job);
        } else {
          processedJobs.push([job]);
        }
      }

      const totalGroups = processedJobs.length;
      const normalized = processedJobs.map((group, groupIdx) => {
        const serial = totalGroups - groupIdx;
        const taskDisplayId = `RU-${String(serial).padStart(4, "0")}`;
        const first = group[0];
        const isAdmin = (first.userName || '').toLowerCase().includes('admin');
        const totalCopies = group.reduce((sum: number, j: any) => sum + (j.copies || 1), 0);
        const activeFiles = group.filter((j: any) => j.status !== 'cancelled' && j.status !== 'failed');
        const explicitAmount = activeFiles.reduce((sum: number, j: any) => sum + (j.amount || 0), 0);
        const calculatedAmount = activeFiles.reduce(
          (sum: number, j: any) => sum + (j.copies || 1) * (j.color ? 10 : 2),
          0
        );
        const totalAmount = isAdmin ? 0 : (explicitAmount > 0 ? explicitAmount : calculatedAmount);
        
        let overallStatus = 'completed';
        if (group.some((j: any) => j.status === 'failed')) overallStatus = 'failed';
        else if (group.some((j: any) => j.status === 'printing')) overallStatus = 'printing';
        else if (group.some((j: any) => j.status === 'queued')) overallStatus = 'queued';
        else if (group.some((j: any) => j.status === 'paid')) overallStatus = 'paid';
        else if (group.every((j: any) => j.status === 'cancelled')) overallStatus = 'cancelled';

        return {
          id: first.id,
          taskDisplayId,
          name: first.userName || "Anonymous",
          enrollmentNo: null,
          userType: "student",
          createdAt: first.createdAt,
          amount: totalAmount,
          totalPages: totalCopies,
          status: overallStatus,
          originalJobs: group,
          files: group.map((j: any) => ({
            name: j.filename || "document.pdf",
            size: 0,
            originalId: j.id,
            status: j.status,
            color: j.color || false,
            pagesPerSheet: j.pages_per_sheet || j.pagesPerSheet || 1,
            paperSize: j.paper_size || j.paperSize || "A4",
            duplex: j.duplex,
            copies: j.copies || 1,
          }))
        };
      });

      setJobs(normalized);
      setPrinterLastSeen(data.printerLastSeen || null);
    } catch (err: any) {
      // In dev mode with Next.js Turbopack, transient network aborts/HMR reloads can throw TypeError: Failed to fetch.
      // Silently catch so it doesn't pop up an error modal over the admin dashboard.
      console.warn("Failed to fetch admin jobs (will retry on next poll):", err?.message || err);
    }
  };

  const handleAction = async (id: string, action: 'cancel' | 'retry' | 'approve') => {
    if (!user?.password) return;
    try {
      const res = await fetch(`/api/admin/jobs/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.password}`
        }
      });
      if (res.ok) {
        load(); // Reload the table to reflect status changes
      } else {
        console.error(`Failed to ${action} job`, await res.text());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveBatch = async (jobGroup: any[]) => {
    if (!user?.password) return;
    
    // Find all files in this batch that can be approved
    const approvableIds = jobGroup
      .filter(f => f.status === 'paid' || f.status === 'pending_payment')
      .map(f => f.originalId || f.id);
      
    if (approvableIds.length === 0) return;
    
    try {
      const promises = approvableIds.map(id => 
        fetch(`/api/admin/jobs/${id}/approve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.password}`
          }
        })
      );
      
      await Promise.all(promises);
      load();
    } catch (err) {
      console.error("Failed to approve batch", err);
    }
  };

  const handleRetryBatch = async (jobGroup: any[]) => {
    if (!user?.password) return;
    
    const retryableIds = jobGroup
      .filter(f => f.status === 'failed')
      .map(f => f.originalId || f.id);
      
    if (retryableIds.length === 0) return;
    
    try {
      const promises = retryableIds.map(id => 
        fetch(`/api/admin/jobs/${id}/retry`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.password}`
          }
        })
      );
      
      await Promise.all(promises);
      load();
    } catch (err) {
      console.error("Failed to retry batch", err);
    }
  };

  const handleCancelBatch = async (jobGroup: any[]) => {
    if (!user?.password) return;
    
    // Find all files in this batch that can be cancelled
    const cancellableIds = jobGroup
      .filter(f => f.status !== 'completed' && f.status !== 'cancelled')
      .map(f => f.originalId || f.id);
      
    if (cancellableIds.length === 0) return;
    
    try {
      const promises = cancellableIds.map(id => 
        fetch(`/api/admin/jobs/${id}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.password}`
          }
        })
      );
      
      await Promise.all(promises);
      load();
    } catch (err) {
      console.error("Failed to cancel batch", err);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [user]);

  const filtered = jobs.filter((j) => {
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      (j.taskDisplayId || '').toLowerCase().includes(term) ||
      (j.name || '').toLowerCase().includes(term) ||
      (j.id || '').toLowerCase().includes(term) ||
      (j.enrollmentNo || '').toLowerCase().includes(term) ||
      (j.files || []).some((f: any) => (f.name || '').toLowerCase().includes(term));
    const matchStatus = statusFilter === "ALL" || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusTabs: Array<{ id: string; label: string; count: number }> = [
    { id: "ALL", label: "All", count: jobs.length },
    { id: "paid", label: "Awaiting Release", count: jobs.filter((j) => j.status === "paid").length },
    { id: "queued", label: "In Queue", count: jobs.filter((j) => j.status === "queued").length },
    { id: "printing", label: "Printing", count: jobs.filter((j) => j.status === "printing").length },
    { id: "completed", label: "Done", count: jobs.filter((j) => j.status === "completed").length },
    { id: "failed", label: "Failed", count: jobs.filter((j) => j.status === "failed").length },
  ];

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedJobs = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isPrinterConnected = printerLastSeen ? (new Date().getTime() - new Date(printerLastSeen + 'Z').getTime() < 15000) : false;

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0">
      {/* Printer Heartbeat Banner */}
      <div style={{
        padding: '12px 20px',
        borderRadius: '8px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        background: isPrinterConnected ? '#e8f5e9' : '#ffebee',
        color: isPrinterConnected ? '#2e7d32' : '#c62828',
        border: `1px solid ${isPrinterConnected ? '#c8e6c9' : '#ffcdd2'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: isPrinterConnected ? '#4caf50' : '#f44336',
            boxShadow: isPrinterConnected ? '0 0 8px #4caf50' : '0 0 8px #f44336'
          }} />
          {isPrinterConnected ? 'Printer daemon is CONNECTED and polling actively.' : 'PRINTER OFFLINE: The Mac print daemon is not connected!'}
        </div>
        {!isPrinterConnected && (
          <a
            href="ruprint://start"
            className="hidden md:inline-block px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            Start Print Server
          </a>
        )}
      </div>

      {/* Controls row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-2xl bg-card/50 backdrop-blur-md p-3.5 shadow-sm">
        {/* Status tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl overflow-x-auto shrink-0 select-none">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                className={cn(
                  "relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all outline-none cursor-pointer whitespace-nowrap",
                  isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="adminStatusPill"
                    className="absolute inset-0 rounded-lg bg-background/90 shadow-sm"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
                <span className="relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-muted/60 text-muted-foreground">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + refresh */}
        <div className="flex items-center gap-2 flex-1 lg:max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search by name, job ID, file…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-10 h-10 text-xs bg-muted/40 border-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-xl"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            className="gap-1.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/70 shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 rounded-2xl bg-card/40 backdrop-blur-md overflow-hidden shadow-xs flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 dark:bg-muted/20 hover:bg-muted/30 border-none">
              <TableHead className="text-muted-foreground/70 font-semibold w-28 hidden sm:table-cell">Task ID</TableHead>
              <TableHead className="text-muted-foreground/70 font-semibold">Name</TableHead>
              <TableHead className="text-muted-foreground/70 font-semibold hidden md:table-cell">Files</TableHead>
              <TableHead className="text-muted-foreground/70 font-semibold hidden md:table-cell">Amount</TableHead>
              <TableHead className="text-muted-foreground/70 font-semibold">Status</TableHead>
              <TableHead className="text-muted-foreground/70 font-semibold hidden sm:table-cell">Submitted</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedJobs.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-36 text-center text-xs text-muted-foreground">
                  {jobs.length === 0 ? "No print jobs yet." : "No jobs match your filter."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedJobs.map((job, index) => {
                const isExpanded = expandedId === job.id;
                const taskDisplayId = job.taskDisplayId || `RU-${String(filtered.length - ((currentPage - 1) * itemsPerPage + index)).padStart(4, "0")}`;
                const isAdminJob = (job.name || '').toLowerCase().includes('admin');
                const nUpFile = job.files.find((f: any) => f.pagesPerSheet > 1);
                return (
                  <React.Fragment key={job.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40 transition-all h-[4.5rem]"
                      onClick={() => setExpandedId(isExpanded ? null : job.id)}
                    >
                      {/* Task ID / Serial */}
                      <TableCell className="px-4 hidden sm:table-cell">
                        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                          {taskDisplayId}
                        </span>
                      </TableCell>

                      {/* Name */}
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-primary font-bold text-xs sm:hidden shrink-0">{taskDisplayId}</span>
                          <div className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            isAdminJob
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              : "bg-primary/10 text-primary"
                          )}>
                            {isAdminJob ? "👑" : (job.name || 'A')[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold">{job.name}</span>
                              {isAdminJob && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                  👑 Admin Print
                                </span>
                              )}
                            </div>
                            {/* Mobile-only files info */}
                            <span className="text-[10px] text-muted-foreground md:hidden mt-0.5 flex items-center gap-1">
                              <span>{job.files.length} file{job.files.length !== 1 ? "s" : ""}</span>
                              {job.totalPages > 0 && <span>· {job.totalPages} pg</span>}
                              {nUpFile && (
                                <span className="px-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                                  {nUpFile.pagesPerSheet}-Up
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Files (Hidden on mobile) */}
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {job.files.length > 1 ? (
                            <Folder className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                          )}
                          <span className="text-xs text-foreground font-medium">
                            {job.files.length} file{job.files.length !== 1 ? "s" : ""}
                          </span>
                          {job.totalPages > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              · {job.totalPages} pg
                            </span>
                          )}
                          {nUpFile && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                              {nUpFile.pagesPerSheet}-Up
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="hidden md:table-cell">
                        {isAdminJob ? (
                          <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 border border-border/50 px-2 py-0.5 rounded-md">
                            ₹0
                          </span>
                        ) : (
                          <span className="text-sm font-bold font-mono text-foreground">
                            ₹{job.amount}
                          </span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold",
                            STATUS_STYLES[job.status as JobStatus]
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                          {STATUS_LABEL[job.status as JobStatus]}
                        </span>
                      </TableCell>

                      {/* Time */}
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatTime(job.createdAt)}
                        </span>
                      </TableCell>

                      {/* Actions & Expand toggle */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Accept & Print for Paid / Awaiting Release jobs */}
                          {job.status === 'paid' && (
                            <Button
                              size="sm"
                              className="h-7 text-[11px] px-3 font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all gap-1.5 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveBatch(job.originalJobs);
                              }}
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Accept & Print
                            </Button>
                          )}

                          {/* Retry Print for Failed jobs */}
                          {job.status === 'failed' && (
                            <Button
                              size="sm"
                              className="h-7 text-[11px] px-3 font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all gap-1.5 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryBatch(job.originalJobs);
                              }}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Retry Print
                            </Button>
                          )}

                          {/* Cancel button if not completed and not cancelled */}
                          {job.status !== 'completed' && job.status !== 'cancelled' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-2.5 font-bold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/30 transition-all shadow-xs cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelBatch(job.originalJobs);
                              }}
                            >
                              {job.files.length > 1 ? "Cancel Batch" : "Cancel"}
                            </Button>
                          )}

                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 cursor-pointer" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 cursor-pointer" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded file list */}
                    <AnimatePresence>
                      {isExpanded && (
                        <TableRow key={`${job.id}-expanded`} className="hover:bg-transparent">
                          <TableCell colSpan={7} className="p-0 border-none">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-2 bg-muted/20 space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Files in this job
                                  </p>
                                </div>
                                {job.files.map((f: any, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between gap-3 rounded-xl bg-card/60 border border-border/50 px-3.5 py-2.5"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <FileText className="h-4 w-4 text-primary shrink-0" />
                                      <p className="text-xs font-semibold text-foreground truncate">
                                        {f.name}
                                      </p>
                                      {f.color ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                                          Colour
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-foreground/70 border border-border/50 shrink-0">
                                          B&amp;W
                                        </span>
                                      )}
                                      {f.pagesPerSheet > 1 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                                          {f.pagesPerSheet}-Up
                                        </span>
                                      )}
                                      {f.paperSize === "A3" && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                                          A3
                                        </span>
                                      )}
                                      {f.copies > 1 && (
                                        <span className="text-[10px] text-muted-foreground font-mono font-bold shrink-0">
                                          ×{f.copies}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {f.status === 'paid' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-[11px] px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 font-semibold"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAction(f.originalId, 'approve');
                                          }}
                                        >
                                          <Printer className="w-3.5 h-3.5 mr-1" />
                                          Accept
                                        </Button>
                                      )}
                                      {f.status === 'failed' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-[11px] px-2.5 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAction(f.originalId, 'retry');
                                          }}
                                        >
                                          Retry
                                        </Button>
                                      )}
                                      {f.status !== 'completed' && f.status !== 'cancelled' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-[11px] px-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAction(f.originalId, 'cancel');
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      )}
                                      <Badge variant="outline" className={`text-[10px] ml-2 ${STATUS_STYLES[f.status] || ''}`}>
                                        {STATUS_LABEL[f.status] || f.status}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          </TableCell>
                        </TableRow>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-2 py-1">
          <div className="text-[11px] font-medium text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="h-7 text-[11px] px-2.5 rounded-lg"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="h-7 text-[11px] px-2.5 rounded-lg"
            >
              Next
            </Button>
          </div>
        </div>
    </div>
  );
}
