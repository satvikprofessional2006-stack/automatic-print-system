"use client";

import React, { useEffect, useState, useMemo } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  IndianRupee,
  Search,
  RefreshCw,
  Calendar,
  Download,
  TrendingUp,
  FileText,
  Folder,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  CreditCard,
  Layers,
  ArrowUpDown,
  Filter,
  X,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TransactionFile {
  originalId: string;
  name: string;
  copies: number;
  status: string;
  color?: boolean;
}

export interface Transaction {
  id: string;
  internalId: string;
  name: string;
  userType: string;
  createdAt: string;
  dateKey: string; // YYYY-MM-DD
  amount: number;
  totalPages: number;
  status: "completed" | "paid" | "queued" | "printing" | "failed" | "cancelled" | "pending_payment";
  paymentMethod: string;
  files: TransactionFile[];
  originalJobs: any[];
}

export interface DayWiseSummary {
  dateKey: string;
  formattedDate: string;
  dayName: string;
  transactionCount: number;
  pagesCount: number;
  totalRevenue: number;
  successfulOrders: number;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  printing: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30",
  queued: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30",
  pending_payment: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Paid & Done",
  paid: "Paid",
  printing: "Printing",
  queued: "In Queue",
  pending_payment: "Pending",
  failed: "Failed",
  cancelled: "Cancelled",
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateLabel(dateKey: string) {
  // dateKey: YYYY-MM-DD
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDayName(dateKey: string) {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return "";
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type PeriodFilter = "all" | "today" | "yesterday" | "7days" | "30days" | "this_month" | "custom";

export function RevenueTab() {
  const { user, logout } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [selectedSingleDay, setSelectedSingleDay] = useState<string>("");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSubView, setActiveSubView] = useState<"daywise" | "transactions">("daywise");
  const itemsPerPage = 12;

  const loadData = async () => {
    if (!user?.password) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/jobs", {
        headers: { Authorization: `Bearer ${user.password}` },
        cache: "no-store",
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      const rawJobs = data.jobs || [];

      // Group into transactions within 60 seconds for same user
      const processedGroups: any[][] = [];
      for (const job of rawJobs) {
        const existingGroupIndex = processedGroups.findIndex((group) => {
          const firstInGroup = group[0];
          const lastInGroup = group[group.length - 1];
          if (firstInGroup.userName !== job.userName) return false;

          const timeDiffFirst = Math.abs(
            new Date(firstInGroup.createdAt).getTime() - new Date(job.createdAt).getTime()
          );
          const timeDiffLast = Math.abs(
            new Date(lastInGroup.createdAt).getTime() - new Date(job.createdAt).getTime()
          );

          return timeDiffFirst <= 60000 || timeDiffLast <= 60000;
        });

        if (existingGroupIndex !== -1) {
          processedGroups[existingGroupIndex].push(job);
        } else {
          processedGroups.push([job]);
        }
      }

      const totalOrdersCount = processedGroups.length;
      const normalized: Transaction[] = processedGroups.map((group, groupIdx) => {
        const first = group[0];
        const seqNumber = totalOrdersCount - groupIdx;
        const internalId = `RU-${String(seqNumber).padStart(4, "0")}`;
        const totalCopies = group.reduce(
          (sum: number, j: any) => sum + (j.copies || 1),
          0
        );

        // Calculate amount: if provided in DB use it, otherwise apply B&W (₹2) and Colour (₹10) rates
        const explicitAmount = group.reduce(
          (sum: number, j: any) => sum + (j.amount || 0),
          0
        );
        const calculatedAmount = group.reduce(
          (sum: number, j: any) => sum + (j.copies || 1) * (j.color ? 10 : 2),
          0
        );
        const amount = explicitAmount > 0 ? explicitAmount : calculatedAmount;

        let overallStatus: Transaction["status"] = "completed";
        if (group.some((j: any) => j.status === "failed")) overallStatus = "failed";
        else if (group.some((j: any) => j.status === "printing")) overallStatus = "printing";
        else if (group.some((j: any) => j.status === "queued")) overallStatus = "queued";
        else if (group.every((j: any) => j.status === "cancelled")) overallStatus = "cancelled";

        const dateObj = new Date(first.createdAt);
        const dateKey = toLocalDateKey(dateObj);

        return {
          id: first.id,
          internalId,
          name: first.userName || "Student",
          userType: "student",
          createdAt: first.createdAt,
          dateKey,
          amount,
          totalPages: totalCopies,
          status: overallStatus,
          paymentMethod: "UPI / GPay",
          originalJobs: group,
          files: group.map((j: any) => ({
            originalId: j.id,
            name: j.filename || "document.pdf",
            copies: j.copies || 1,
            status: j.status,
            color: j.color || false,
          })),
        };
      });

      setTransactions(normalized);
    } catch (err) {
      console.error("Error loading revenue data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle preset date filters
  const dateFilteredTransactions = useMemo(() => {
    const now = new Date();
    const todayKey = toLocalDateKey(now);

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = toLocalDateKey(yesterday);

    return transactions.filter((t) => {
      // When on custom range, filter strictly by custom start/end
      if (period === "custom") {
        if (customStartDate && t.dateKey < customStartDate) return false;
        if (customEndDate && t.dateKey > customEndDate) return false;
        return true;
      }

      // If user selected a specific day from the single day filter
      if (selectedSingleDay) {
        return t.dateKey === selectedSingleDay;
      }

      if (period === "all") return true;

      if (period === "today") {
        return t.dateKey === todayKey;
      }

      if (period === "yesterday") {
        return t.dateKey === yesterdayKey;
      }

      if (period === "7days") {
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 7);
        const cutoffKey = toLocalDateKey(cutoff);
        return t.dateKey >= cutoffKey;
      }

      if (period === "30days") {
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 30);
        const cutoffKey = toLocalDateKey(cutoff);
        return t.dateKey >= cutoffKey;
      }

      if (period === "this_month") {
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        return t.dateKey.startsWith(currentYearMonth);
      }

      return true;
    });
  }, [transactions, period, selectedSingleDay, customStartDate, customEndDate]);

  // Status & Search filtering
  const fullyFilteredTransactions = useMemo(() => {
    return dateFilteredTransactions.filter((t) => {
      // Status
      if (statusFilter !== "ALL") {
        if (statusFilter === "paid_only") {
          if (t.status !== "completed" && t.status !== "paid") return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }

      // Search term
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchesInternalId = (t.internalId || "").toLowerCase().includes(term);
        const matchesName = (t.name || "").toLowerCase().includes(term);
        const matchesId = (t.id || "").toLowerCase().includes(term);
        const matchesFile = t.files.some((f) => (f.name || "").toLowerCase().includes(term));
        return matchesInternalId || matchesName || matchesId || matchesFile;
      }

      return true;
    });
  }, [dateFilteredTransactions, statusFilter, search]);

  // Revenue & Analytics KPIs (calculated on completed/paid within filtered set)
  const stats = useMemo(() => {
    const paidList = fullyFilteredTransactions.filter(
      (t) => t.status === "completed" || t.status === "paid"
    );
    const totalRevenue = paidList.reduce((sum, t) => sum + t.amount, 0);
    const totalPaidOrders = paidList.length;
    const totalPagesBilled = paidList.reduce((sum, t) => sum + t.totalPages, 0);
    const aov = totalPaidOrders > 0 ? (totalRevenue / totalPaidOrders).toFixed(1) : "0";

    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const todayRevenue = transactions
      .filter((t) => t.dateKey === todayKey && (t.status === "completed" || t.status === "paid"))
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingOrders = fullyFilteredTransactions.filter(
      (t) => t.status === "pending_payment" || t.status === "queued" || t.status === "printing"
    ).length;

    return {
      totalRevenue,
      totalPaidOrders,
      totalPagesBilled,
      aov,
      todayRevenue,
      pendingOrders,
    };
  }, [fullyFilteredTransactions, transactions]);

  // Day-wise Summary Aggregation
  const dayWiseData: DayWiseSummary[] = useMemo(() => {
    const map = new Map<string, DayWiseSummary>();

    // Aggregate from dateFilteredTransactions
    for (const t of dateFilteredTransactions) {
      if (!map.has(t.dateKey)) {
        map.set(t.dateKey, {
          dateKey: t.dateKey,
          formattedDate: formatDateLabel(t.dateKey),
          dayName: getDayName(t.dateKey),
          transactionCount: 0,
          pagesCount: 0,
          totalRevenue: 0,
          successfulOrders: 0,
        });
      }

      const item = map.get(t.dateKey)!;
      item.transactionCount += 1;
      item.pagesCount += t.totalPages;

      if (t.status === "completed" || t.status === "paid") {
        item.totalRevenue += t.amount;
        item.successfulOrders += 1;
      }
    }

    // Sort descending by date
    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [dateFilteredTransactions]);

  const maxDailyRevenue = useMemo(() => {
    return Math.max(...dayWiseData.map((d) => d.totalRevenue), 1);
  }, [dayWiseData]);

  // Export CSV
  const handleExportCSV = () => {
    if (fullyFilteredTransactions.length === 0) return;

    const headers = [
      "Task ID",
      "Payment Ref UUID",
      "Customer Name",
      "Date & Time",
      "Date Key",
      "Amount (INR)",
      "Total Pages",
      "Files Count",
      "Status",
      "Payment Method",
      "File Names",
    ];

    const rows = fullyFilteredTransactions.map((t) => [
      `"${t.internalId}"`,
      `"${t.id}"`,
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.createdAt}"`,
      `"${t.dateKey}"`,
      t.amount,
      t.totalPages,
      t.files.length,
      `"${t.status}"`,
      `"${t.paymentMethod}"`,
      `"${t.files.map((f) => f.name).join("; ").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `ru_print_revenue_${selectedSingleDay || period}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination for transactions list
  const totalPages = Math.ceil(fullyFilteredTransactions.length / itemsPerPage);
  const paginatedTransactions = fullyFilteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetAllFilters = () => {
    setPeriod("all");
    setSelectedSingleDay("");
    setCustomStartDate("");
    setCustomEndDate("");
    setStatusFilter("ALL");
    setSearch("");
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Revenue & Transactions</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Audit
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time financial audit, day-wise analytics, and UPI payment breakdowns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={fullyFilteredTransactions.length === 0}
            className="h-9 gap-1.5 text-xs rounded-xl bg-card/60 hover:bg-card border-border/70 text-foreground cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV ({fullyFilteredTransactions.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 gap-1.5 text-xs rounded-xl bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {/* Total Revenue */}
        <Card className="border border-border/40 bg-gradient-to-br from-emerald-500/10 via-card/50 to-card/30 backdrop-blur-md rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                Period Revenue
              </p>
              <p className="text-2xl font-extrabold font-mono text-foreground tracking-tight mt-0.5">
                ₹{stats.totalRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                {stats.totalPaidOrders} paid orders
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Revenue */}
        <Card className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                Today's Revenue
              </p>
              <p className="text-2xl font-extrabold font-mono text-foreground tracking-tight mt-0.5">
                ₹{stats.todayRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                All-day collection
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Pages Billed */}
        <Card className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                Pages Billed
              </p>
              <p className="text-2xl font-extrabold font-mono text-foreground tracking-tight mt-0.5">
                {stats.totalPagesBilled.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                ₹1/pg (min ₹5/job)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Avg Order Value */}
        <Card className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                Avg Order Value
              </p>
              <p className="text-2xl font-extrabold font-mono text-foreground tracking-tight mt-0.5">
                ₹{stats.aov}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {stats.pendingOrders > 0 ? `${stats.pendingOrders} pending` : "100% verified"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <div className="rounded-2xl bg-card/50 backdrop-blur-md p-3.5 shadow-sm border border-border/40 space-y-3 shrink-0">
        {/* Row 1: Period quick filters + View switcher */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl overflow-x-auto select-none shrink-0">
            {(
              [
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "7days", label: "Last 7 Days" },
                { id: "30days", label: "Last 30 Days" },
                { id: "this_month", label: "This Month" },
                { id: "custom", label: "Custom Range" },
              ] as const
            ).map((item) => {
              const isActive = period === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setPeriod(item.id);
                    if (item.id === "custom") {
                      setSelectedSingleDay("");
                    } else {
                      setCustomStartDate("");
                      setCustomEndDate("");
                    }
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "relative flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-all outline-none cursor-pointer whitespace-nowrap",
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="revenuePeriodPill"
                      className="absolute inset-0 rounded-lg bg-background shadow-xs"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Subview Toggle: Day-Wise vs All Transactions */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl shrink-0 self-start lg:self-auto">
            <button
              onClick={() => setActiveSubView("daywise")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeSubView === "daywise"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              Day-wise Summary
              <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-mono ml-1">
                {dayWiseData.length}
              </Badge>
            </button>
            <button
              onClick={() => setActiveSubView("transactions")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeSubView === "transactions"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              Transactions List
              <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-mono ml-1">
                {fullyFilteredTransactions.length}
              </Badge>
            </button>
          </div>
        </div>

        {/* Row 2: One-Day Filter (when not custom) OR Custom Range Pickers (when custom), Status Filter, Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-1 border-t border-border/30">
          <div className="flex flex-wrap items-center gap-2">
            {/* When NOT selecting custom dates: keep the one day filter visible */}
            {period !== "custom" && (
              <div className="flex items-center gap-1.5 bg-muted/30 border border-border/40 rounded-xl px-2.5 py-1 text-xs">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground font-medium text-[11px]">Filter Specific Day:</span>
                <input
                  type="date"
                  value={selectedSingleDay}
                  onChange={(e) => {
                    setSelectedSingleDay(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-foreground font-mono text-xs focus:outline-none cursor-pointer"
                />
                {selectedSingleDay && (
                  <button
                    onClick={() => setSelectedSingleDay("")}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                    title="Clear date"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* When selecting custom dates: show ONLY the Custom Range inputs */}
            {period === "custom" && (
              <div className="flex items-center gap-1.5 bg-muted/40 border border-primary/30 rounded-xl px-2.5 py-1 text-xs animate-in fade-in">
                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground text-[11px] font-medium">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-foreground font-mono text-xs focus:outline-none cursor-pointer"
                />
                <span className="text-muted-foreground text-[11px] font-medium">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-foreground font-mono text-xs focus:outline-none cursor-pointer"
                />
                {(customStartDate || customEndDate) && (
                  <button
                    onClick={() => {
                      setCustomStartDate("");
                      setCustomEndDate("");
                    }}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                    title="Clear date range"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Status Dropdown Filter */}
            <div className="flex items-center gap-1 bg-muted/30 border border-border/40 rounded-xl px-2 py-1 text-xs">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-none text-foreground text-xs focus:outline-none cursor-pointer font-medium"
              >
                <option value="ALL" className="bg-popover text-foreground">All Statuses</option>
                <option value="paid_only" className="bg-popover text-foreground">Paid / Done Only</option>
                <option value="pending_payment" className="bg-popover text-foreground">Pending Payment</option>
                <option value="completed" className="bg-popover text-foreground">Completed</option>
                <option value="printing" className="bg-popover text-foreground">Printing</option>
                <option value="queued" className="bg-popover text-foreground">In Queue</option>
                <option value="failed" className="bg-popover text-foreground">Failed</option>
                <option value="cancelled" className="bg-popover text-foreground">Cancelled</option>
              </select>
            </div>

            {(selectedSingleDay || period !== "all" || statusFilter !== "ALL" || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAllFilters}
                className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search customer, ID, file…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-8 text-xs bg-muted/30 border-border/40 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/40"
            />
          </div>
        </div>

        {/* Active Filter Indicator banner if single day is isolated */}
        {period !== "custom" && selectedSingleDay && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs animate-in fade-in">
            <span className="text-foreground font-medium">
              Showing day-specific transactions for: <span className="font-bold text-primary font-mono">{formatDateLabel(selectedSingleDay)} ({getDayName(selectedSingleDay)})</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSingleDay("")}
              className="h-5 px-1.5 text-[10px] text-primary hover:text-primary font-bold cursor-pointer"
            >
              Reset to all dates
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area: Tabbed between Day-wise and Transactions */}
      <div className="flex-1 rounded-2xl bg-card/40 backdrop-blur-md overflow-hidden shadow-xs flex flex-col border border-border/40 min-h-0">
        {activeSubView === "daywise" ? (
          /* ── Day-wise Aggregation Table ── */
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 dark:bg-muted/20 hover:bg-muted/30 border-none">
                  <TableHead className="font-semibold text-muted-foreground/80">Date</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80">Day</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 text-center">Transactions</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 text-center">Successful</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 text-center">Pages Printed</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80">Daily Revenue</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 text-right pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayWiseData.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="h-44 text-center text-xs text-muted-foreground">
                      No revenue data recorded for this date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  dayWiseData.map((day) => {
                    const isSelected = selectedSingleDay === day.dateKey;
                    const revenuePercent = maxDailyRevenue > 0 ? (day.totalRevenue / maxDailyRevenue) * 100 : 0;

                    return (
                      <TableRow
                        key={day.dateKey}
                        className={cn(
                          "cursor-pointer hover:bg-muted/40 transition-colors h-14",
                          isSelected && "bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary"
                        )}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSingleDay("");
                          } else {
                            if (period === "custom") setPeriod("all");
                            setSelectedSingleDay(day.dateKey);
                          }
                          setActiveSubView("transactions");
                          setCurrentPage(1);
                        }}
                      >
                        {/* Date */}
                        <TableCell className="font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 rounded-lg bg-primary/10 items-center justify-center text-primary">
                              <Calendar className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-mono text-xs">{day.formattedDate}</span>
                          </div>
                        </TableCell>

                        {/* Day Name */}
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {day.dayName}
                        </TableCell>

                        {/* Total Transactions */}
                        <TableCell className="text-center font-mono text-xs font-semibold">
                          {day.transactionCount}
                        </TableCell>

                        {/* Successful Orders */}
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                            <CheckCircle2 className="h-3 w-3" />
                            {day.successfulOrders}
                          </span>
                        </TableCell>

                        {/* Pages Printed */}
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {day.pagesCount} pg
                        </TableCell>

                        {/* Daily Revenue with Bar */}
                        <TableCell>
                          <div className="flex flex-col gap-1 w-36 sm:w-44">
                            <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                              ₹{day.totalRevenue.toLocaleString("en-IN")}
                            </span>
                            <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(revenuePercent, 4)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Action Drilldown */}
                        <TableCell className="text-right pr-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2.5 rounded-lg border-border/70 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (period === "custom") setPeriod("all");
                              setSelectedSingleDay(day.dateKey);
                              setActiveSubView("transactions");
                              setCurrentPage(1);
                            }}
                          >
                            View Transactions
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* ── Individual Transactions Table ── */
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 dark:bg-muted/20 hover:bg-muted/30 border-none">
                  <TableHead className="font-semibold text-muted-foreground/80 w-32 px-4">Task ID</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80">Customer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 hidden sm:table-cell">Payment Ref</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 hidden md:table-cell">Files</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80">Status</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80">Amount</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 hidden lg:table-cell">Date & Time</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="h-44 text-center text-xs text-muted-foreground">
                      No transactions match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isExpanded = expandedId === tx.id;

                    return (
                      <React.Fragment key={tx.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40 transition-colors h-16"
                          onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                        >
                          {/* Task ID (RU-xxxx) */}
                          <TableCell className="px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-lg select-all">
                                {tx.internalId}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(tx.internalId);
                                  setCopiedId(tx.internalId);
                                  setTimeout(() => setCopiedId(null), 1800);
                                }}
                                title="Copy Task ID"
                                className="p-1 rounded hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              >
                                {copiedId === tx.internalId ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </TableCell>

                          {/* Customer */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {(tx.name || "S")[0].toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {tx.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  {tx.userType || "Student"}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Payment Reference UUID */}
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-muted-foreground bg-muted/40 dark:bg-muted/30 px-2 py-0.5 rounded-md border border-border/40 select-all" title={tx.id}>
                                {tx.id.slice(0, 8)}…{tx.id.slice(-4)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(tx.id);
                                  setCopiedId(tx.id);
                                  setTimeout(() => setCopiedId(null), 1800);
                                }}
                                title="Copy Payment Ref UUID"
                                className="p-1 rounded hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              >
                                {copiedId === tx.id ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </TableCell>

                          {/* Files */}
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                              {tx.files.length > 1 ? (
                                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span>
                                {tx.files.length} file{tx.files.length !== 1 ? "s" : ""}
                              </span>
                              <span className="text-muted-foreground text-[11px]">
                                · {tx.totalPages} pg
                              </span>
                            </div>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold",
                                STATUS_BADGE_STYLES[tx.status] || STATUS_BADGE_STYLES.completed
                              )}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                              {STATUS_LABELS[tx.status] || tx.status}
                            </span>
                          </TableCell>

                          {/* Amount */}
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-extrabold font-mono text-foreground text-sm">
                                ₹{tx.amount}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium">
                                UPI / GPay
                              </span>
                            </div>
                          </TableCell>

                          {/* Date & Time */}
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatDateTime(tx.createdAt)}
                            </span>
                          </TableCell>

                          {/* Expand chevron */}
                          <TableCell className="text-right pr-4">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground inline" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground inline" />
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <TableRow key={`${tx.id}-expanded`} className="hover:bg-transparent">
                              <TableCell colSpan={8} className="p-0 border-none">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 pt-2 bg-muted/20 space-y-2 border-b border-border/40">
                                    <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground mb-1 gap-2">
                                      <p className="font-semibold uppercase tracking-wider text-[11px]">
                                        Task ID: <span className="font-mono text-primary font-bold text-xs">{tx.internalId}</span> · Payment Ref UUID: <span className="font-mono text-foreground select-all">{tx.id}</span>
                                      </p>
                                      <p className="font-mono text-[11px]">
                                        Recorded: {formatDateTime(tx.createdAt)}
                                      </p>
                                    </div>

                                    {tx.files.map((file, fIdx) => (
                                      <div
                                        key={fIdx}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-card/60 border border-border/40 px-3.5 py-2 text-xs"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <FileText className="h-4 w-4 text-primary shrink-0" />
                                          <span className="font-medium text-foreground truncate">
                                            {file.name}
                                          </span>
                                          {file.color ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                                              Colour
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-foreground/70 border border-border/50 shrink-0">
                                              B&amp;W
                                            </span>
                                          )}
                                          <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                                            ({file.copies} {file.copies === 1 ? "page/copy" : "pages/copies"})
                                          </span>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] capitalize">
                                          {file.status}
                                        </Badge>
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
        )}

        {/* Pagination bar for transactions view */}
        {activeSubView === "transactions" && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 bg-card/20 shrink-0">
            <div className="text-[11px] font-medium text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, fullyFilteredTransactions.length)} of{" "}
              {fullyFilteredTransactions.length} transactions
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-7 text-[11px] px-2.5 rounded-lg cursor-pointer"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-7 text-[11px] px-2.5 rounded-lg cursor-pointer"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
