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
  BookOpen,
  CreditCard,
  Layers,
  ArrowUpDown,
  Filter,
  X,
  Copy,
  Check,
  ArrowRight,
  Zap,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ui/Loader";

let cachedTransactions: Transaction[] = [];
let cachedRevenueLoadedOnce = false;
import { BW_RATE, COLOR_RATE, BW_A3_RATE, COLOR_A3_RATE } from "@/lib/printStore";
import { ExportReportModal } from "./ExportReportModal";

export interface TransactionFile {
  originalId: string;
  name: string;
  copies: number;
  status: string;
  color?: boolean;
  paperSize?: string;
  duplex?: boolean;
  layout?: string;
  pagesPerSheet?: number;
  pageRange?: string;
}

export interface Transaction {
  id: string;
  internalId: string;
  seqNumber: number;
  name: string;
  userType: string;
  course?: string;
  utrNo?: string;
  registerSeqNumber?: number;
  pageSize?: string;
  colorPrints?: number;
  colorPages?: number;
  bwPrints?: number;
  bwPages?: number;
  createdAt: string;
  dateKey: string; // YYYY-MM-DD
  amount: number;
  totalPages: number;
  status: "completed" | "paid" | "queued" | "printing" | "failed" | "cancelled" | "pending_payment";
  paymentMethod: string;
  files: TransactionFile[];
  originalJobs: any[];
}

function extractCourseFromJob(job: any): string {
  const email = (job.userEmail || job.email || '').toLowerCase().trim();
  if (email.includes('@')) {
    const [local, domain] = email.split('@');
    if (!/\d/.test(local)) return 'FACULTY';
    const match = domain.match(/^([^.]+)\.rishihood/);
    if (match && match[1]) {
      const code = match[1].toUpperCase();
      return code === 'NEWTON' ? 'NST' : code;
    }
  }

  if (job.course) {
    const c = String(job.course).toUpperCase();
    return c === 'NEWTON' ? 'NST' : c;
  }
  if (job.department) {
    const d = String(job.department).toUpperCase();
    return d === 'NEWTON' ? 'NST' : d;
  }

  const nameLower = (job.userName || '').toLowerCase();
  if (nameLower.includes('faculty') || nameLower.includes('prof') || nameLower.includes('dr.')) {
    return 'FACULTY';
  }
  return 'CSDS';
}

function getUtrNumber(job: any): string {
  if (job.utrNo || job.utr_no) return String(job.utrNo || job.utr_no);
  if (job.upiRef || job.upi_ref) return String(job.upiRef || job.upi_ref);
  if (job.payment_id || job.paymentId) return String(job.payment_id || job.paymentId);
  return "—";
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

import { formatIndianDateTime, parseUtcDate } from "@/lib/utils";

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
  return formatIndianDateTime(iso);
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

function toLocalDateKey(d: any): string {
  const dateObj = parseUtcDate(d);
  // Get date key in Indian Standard Time (IST)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj); // Returns "YYYY-MM-DD"
  return parts;
}

type PeriodFilter = "all" | "today" | "yesterday" | "7days" | "30days" | "this_month" | "custom";

interface RevenueTabProps {
  initialSubView?: "daywise" | "transactions" | "register";
}

export function RevenueTab({ initialSubView = "daywise" }: RevenueTabProps = {}) {
  const { user, logout } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>(cachedTransactions);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(cachedRevenueLoadedOnce);
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
  const [activeSubView, setActiveSubView] = useState<"daywise" | "transactions" | "register">(initialSubView);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [hideZeroRevenueDays, setHideZeroRevenueDays] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const itemsPerPage = 12;

  useEffect(() => {
    if (initialSubView) {
      setActiveSubView(initialSubView);
    }
  }, [initialSubView]);

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
      if (!res.ok) {
        console.warn('Revenue jobs polling failed with status:', res.status);
        return;
      }
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
            parseUtcDate(firstInGroup.createdAt).getTime() - parseUtcDate(job.createdAt).getTime()
          );
          const timeDiffLast = Math.abs(
            parseUtcDate(lastInGroup.createdAt).getTime() - parseUtcDate(job.createdAt).getTime()
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
        // Calculate billable and active files (exclude cancelled/failed files)
        const activeFiles = group.filter((j: any) => j.status !== 'cancelled' && j.status !== 'failed');
        const filesForPageCount = activeFiles.length > 0 ? activeFiles : group;

        let colorPrints = 0;
        let colorSheets = 0;
        let bwPrints = 0;
        let bwSheets = 0;

        filesForPageCount.forEach((j: any) => {
          const copies = j.copies || 1;
          const isDuplex = Boolean(j.doubleSided || j.double_sided || j.duplex);
          const rawPages = j.pages || j.totalPages || j.numPages || 1;

          let printedSides = copies * rawPages;
          let physicalSheets = copies * rawPages;

          if (isDuplex) {
            if (rawPages <= 1) {
              printedSides = copies * 2;
              physicalSheets = copies * 1;
            } else {
              printedSides = copies * rawPages;
              physicalSheets = copies * Math.ceil(rawPages / 2);
            }
          }

          if (j.color) {
            colorPrints += printedSides;
            colorSheets += physicalSheets;
          } else {
            bwPrints += printedSides;
            bwSheets += physicalSheets;
          }
        });

        const totalSheets = colorSheets + bwSheets;

        const hasA3 = group.some((j: any) => (j.paper_size || j.paperSize) === "A3");
        const pageSize = hasA3 ? "A3" : "A4";
        const course = extractCourseFromJob(first);
        const utrNo = getUtrNumber(first);

        // Calculate amount: only include non-cancelled and non-failed files in billable amount
        const explicitAmount = activeFiles.reduce(
          (sum: number, j: any) => sum + (j.amount || 0),
          0
        );
        const calculatedAmount = activeFiles.reduce((sum: number, j: any) => {
          const copies = j.copies || 1;
          const isDuplex = Boolean(j.doubleSided || j.double_sided || j.duplex);
          const rawPages = j.pages || j.totalPages || j.numPages || 1;
          const printedSides = copies * (isDuplex && rawPages <= 1 ? 2 : rawPages);
          const rate = (j.paper_size || j.paperSize) === "A3" ? (j.color ? COLOR_A3_RATE : BW_A3_RATE) : (j.color ? COLOR_RATE : BW_RATE);
          return sum + printedSides * rate;
        }, 0);
        const isAdmin = (first.userName || '').toLowerCase().includes('admin');
        const amount = isAdmin ? 0 : (explicitAmount > 0 ? explicitAmount : calculatedAmount);

        let overallStatus: Transaction["status"] = "completed";
        if (group.some((j: any) => j.status === "failed")) overallStatus = "failed";
        else if (group.some((j: any) => j.status === "printing")) overallStatus = "printing";
        else if (group.some((j: any) => j.status === "queued")) overallStatus = "queued";
        else if (group.some((j: any) => j.status === "paid")) overallStatus = "paid";
        else if (group.every((j: any) => j.status === "cancelled")) overallStatus = "cancelled";

        const dateObj = parseUtcDate(first.createdAt);
        const dateKey = toLocalDateKey(dateObj);

        return {
          id: first.id,
          internalId,
          seqNumber,
          name: first.userName || "Student",
          userType: course === "FACULTY" ? "Faculty" : "Student",
          course,
          utrNo,
          pageSize,
          colorPrints,
          colorPages: colorSheets,
          bwPrints,
          bwPages: bwSheets,
          createdAt: first.createdAt,
          dateKey,
          amount,
          totalPages: totalSheets,
          status: overallStatus,
          paymentMethod: "UPI / GPay",
          originalJobs: group,
          files: group.map((j: any) => ({
            originalId: j.id,
            name: j.filename || "document.pdf",
            copies: j.copies || 1,
            status: j.status,
            color: j.color || false,
            paperSize: (j.paper_size || j.paperSize || "A4").toUpperCase(),
            duplex: j.duplex !== undefined ? j.duplex : Boolean(j.doubleSided || j.double_sided),
            layout: (j.layout || "portrait").toLowerCase(),
            pagesPerSheet: j.pages_per_sheet || j.pagesPerSheet || 1,
            pageRange: j.page_range || j.pageRange || "all",
          })),
        };
      });

      cachedTransactions = normalized;
      cachedRevenueLoadedOnce = true;
      setTransactions(normalized);
      setHasLoadedOnce(true);
    } catch (err) {
      console.error("Error loading revenue data:", err);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
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
    const totalBwPages = paidList.reduce((sum, t) => sum + (t.bwPages || 0), 0);
    const totalColorPages = paidList.reduce((sum, t) => sum + (t.colorPages || 0), 0);
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
      totalBwPages,
      totalColorPages,
      aov,
      todayRevenue,
      pendingOrders,
    };
  }, [fullyFilteredTransactions, transactions]);

  // Day-wise Summary Aggregation
  const rawDayWiseData: DayWiseSummary[] = useMemo(() => {
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

  const activeDaysCount = useMemo(() => {
    return rawDayWiseData.filter((d) => d.totalRevenue > 0).length;
  }, [rawDayWiseData]);

  const dayWiseData: DayWiseSummary[] = useMemo(() => {
    let list = rawDayWiseData;

    if (hideZeroRevenueDays) {
      list = list.filter((d) => d.totalRevenue > 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((d) =>
        d.formattedDate.toLowerCase().includes(q) ||
        d.dayName.toLowerCase().includes(q) ||
        d.dateKey.includes(q)
      );
    }

    return list;
  }, [rawDayWiseData, hideZeroRevenueDays, search]);

  const txPaidCount = useMemo(() => {
    return dateFilteredTransactions.filter(
      (t) => t.status === "completed" || t.status === "paid"
    ).length;
  }, [dateFilteredTransactions]);

  const txCancelledCount = useMemo(() => {
    return dateFilteredTransactions.filter(
      (t) => t.status === "cancelled" || t.status === "failed"
    ).length;
  }, [dateFilteredTransactions]);

  // Export CSV in Official University Register Logbook Format (Chronological Order: 1 -> 94)
  // Register Logbook: only show completed/paid (successful) transactions
  // Failed, cancelled, refunded, queued jobs should NOT appear in the official register
  const registerTransactions = useMemo(() => {
    const list = fullyFilteredTransactions.filter(
      (t) => t.status === "completed" || t.status === "paid"
    );
    // Sort chronologically ascending (oldest first) to assign continuous official register serial numbers 1..N
    const chronological = [...list].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return chronological.map((t, index) => ({
      ...t,
      registerSeqNumber: index + 1,
    }));
  }, [fullyFilteredTransactions]);

  // Export CSV in Official University Register Logbook Format (Chronological Order: 1 -> N)
  const handleExportCSV = () => {
    const isRegister = activeSubView === "register";
    const sourceList = isRegister ? registerTransactions : fullyFilteredTransactions;
    if (sourceList.length === 0) return;

    // Export chronologically: oldest print first (S. No. 1) up to newest print
    const sortedForCsv = isRegister
      ? [...sourceList].sort((a, b) => (a.registerSeqNumber || 0) - (b.registerSeqNumber || 0))
      : [...sourceList].sort((a, b) => a.seqNumber - b.seqNumber);

    const headers = [
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

    const rows = sortedForCsv.map((t, idx) => {
      const d = new Date(t.createdAt);
      const dateFormatted = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getFullYear()).slice(-2)}`;
      
      const hasColor = (t.colorPrints || t.colorPages || 0) > 0;
      const hasBw = (t.bwPrints || t.bwPages || 0) > 0;

      return [
        isRegister ? (t.registerSeqNumber || idx + 1) : (t.seqNumber || idx + 1),
        `"${dateFormatted}"`,
        `"${(t.name || "").replace(/"/g, '""')}"`,
        `"${t.course || "CSDS"}"`,
        `"${t.utrNo || ""}"`,
        `"${t.pageSize || "A4"}"`,
        hasColor ? (t.colorPrints ?? 0) : '"-"',
        hasColor ? (t.colorPages ?? 0) : '"-"',
        hasBw ? (t.bwPrints ?? 0) : '"-"',
        hasBw ? (t.bwPages ?? 0) : '"-"',
        t.totalPages,
        `"₹${t.amount}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `ru_print_register_logbook_${selectedSingleDay || period}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort order applied for UI list display
  const displayTransactions = useMemo(() => {
    if (activeSubView === "register") {
      if (sortOrder === "asc") {
        return [...registerTransactions].sort(
          (a, b) => (a.registerSeqNumber || 0) - (b.registerSeqNumber || 0)
        );
      }
      return [...registerTransactions].sort(
        (a, b) => (b.registerSeqNumber || 0) - (a.registerSeqNumber || 0)
      );
    }
    const sourceList = fullyFilteredTransactions;
    if (sortOrder === "asc") {
      return [...sourceList].sort((a, b) => a.seqNumber - b.seqNumber);
    }
    return [...sourceList].sort((a, b) => b.seqNumber - a.seqNumber);
  }, [fullyFilteredTransactions, registerTransactions, activeSubView, sortOrder]);

  // Pagination for transactions and register views
  const totalPages = Math.ceil(displayTransactions.length / itemsPerPage);
  const paginatedTransactions = displayTransactions.slice(
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
    setHideZeroRevenueDays(false);
    setCurrentPage(1);
  };

  if (!hasLoadedOnce) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[420px] p-8">
        <Loader size="lg" text="Loading revenue metrics..." subtext="Syncing register and transaction data" />
      </div>
    );
  }

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
            onClick={() => setIsExportModalOpen(true)}
            disabled={transactions.length === 0}
            className="h-9 gap-1.5 text-xs rounded-xl bg-card/60 hover:bg-card border-border/70 text-foreground cursor-pointer shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
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
        <Card className="border border-border/60 bg-gradient-to-br from-emerald-500/10 via-card to-card dark:via-card/50 dark:to-card/30 backdrop-blur-md rounded-2xl shadow-2xs hover:shadow-xs transition-all">
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
        <Card className="border border-border/60 bg-card dark:bg-card/40 backdrop-blur-md rounded-2xl shadow-2xs hover:shadow-xs transition-all">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div
              className={cn(
                "p-2.5 rounded-xl shrink-0",
                stats.todayRevenue > 0
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {stats.todayRevenue > 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <Clock className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                Today's Revenue
              </p>
              <p className="text-2xl font-extrabold font-mono text-foreground tracking-tight mt-0.5">
                ₹{stats.todayRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {stats.todayRevenue > 0 ? "All-day collection (IST)" : "No prints today yet (IST)"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Pages Billed */}
        <Card className="border border-border/60 bg-card dark:bg-card/40 backdrop-blur-md rounded-2xl shadow-2xs hover:shadow-xs transition-all">
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
              <p 
                className="text-[10px] text-muted-foreground mt-0.5 truncate"
                title={`Official Rates: ₹${BW_RATE}/pg B&W · ₹${COLOR_RATE}/pg Colour (No min fee)`}
              >
                {stats.totalBwPages > 0 || stats.totalColorPages > 0
                  ? `${stats.totalBwPages} B&W · ${stats.totalColorPages} Colour`
                  : `₹${BW_RATE}/pg B&W · ₹${COLOR_RATE}/pg Colour`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Avg Order Value */}
        <Card className="border border-border/60 bg-card dark:bg-card/40 backdrop-blur-md rounded-2xl shadow-2xs hover:shadow-xs transition-all">
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

      {/* ── Level 1: Primary View Mode Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="inline-flex p-1 rounded-2xl bg-muted/40 border border-border/40 backdrop-blur-md shadow-2xs self-start">
          <button
            type="button"
            onClick={() => {
              setActiveSubView("daywise");
              setCurrentPage(1);
            }}
            className={cn(
              "relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer select-none",
              activeSubView === "daywise"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {activeSubView === "daywise" && (
              <motion.div
                layoutId="revenueSubViewPill"
                className="absolute inset-0 bg-primary rounded-xl shadow-xs"
                transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Day-wise Summary
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                activeSubView === "daywise" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {dayWiseData.length}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubView("transactions");
              setCurrentPage(1);
            }}
            className={cn(
              "relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer select-none",
              activeSubView === "transactions"
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {activeSubView === "transactions" && (
              <motion.div
                layoutId="revenueSubViewPill"
                className="absolute inset-0 bg-primary rounded-xl shadow-xs"
                transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Transactions List
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                activeSubView === "transactions" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {fullyFilteredTransactions.length}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubView("register");
              setCurrentPage(1);
            }}
            className={cn(
              "relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer select-none",
              activeSubView === "register"
                ? "text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {activeSubView === "register" && (
              <motion.div
                layoutId="revenueSubViewPill"
                className="absolute inset-0 bg-amber-600 rounded-xl shadow-xs"
                transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Register Logbook
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                activeSubView === "register" ? "bg-white/25 text-white" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              )}>
                {registerTransactions.length}
              </span>
            </span>
          </button>
        </div>

        {/* View mode contextual subtitle / description */}
        <p className="text-xs text-muted-foreground hidden sm:block">
          {activeSubView === "daywise" && "Daily revenue totals, success rates & volume distribution"}
          {activeSubView === "transactions" && "Granular order-level breakdown with file & print options"}
          {activeSubView === "register" && "Official continuous logbook (S. No. 1 → N) for university records"}
        </p>
      </div>

      {/* Filter and Control Bar */}
      <div className="rounded-2xl bg-card/50 backdrop-blur-md p-3.5 shadow-sm border border-border/40 space-y-3 shrink-0">
        {/* Row 1: Period quick filters + Day-wise Active Days filter */}
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

          {/* Quick toggle in Day-wise mode: Segmented Pill Toggle for All Days vs Active Only */}
          {activeSubView === "daywise" && (
            <div className="inline-flex p-0.5 rounded-xl bg-muted/40 border border-border/40 backdrop-blur-md self-start lg:self-auto shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => setHideZeroRevenueDays(false)}
                className={cn(
                  "relative px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer select-none",
                  !hideZeroRevenueDays
                    ? "text-foreground bg-background shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Days ({rawDayWiseData.length})
              </button>
              <button
                type="button"
                onClick={() => setHideZeroRevenueDays(true)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer select-none",
                  hideZeroRevenueDays
                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="h-3 w-3 text-emerald-500 fill-emerald-500/20" />
                Active Only ({activeDaysCount})
              </button>
            </div>
          )}

          {/* Quick toggle in Transactions mode: Segmented Pill Toggle for Paid vs All vs Cancelled */}
          {activeSubView === "transactions" && (
            <div className="inline-flex p-0.5 rounded-xl bg-muted/40 border border-border/40 backdrop-blur-md self-start lg:self-auto shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("paid_only");
                  setCurrentPage(1);
                }}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer select-none",
                  statusFilter === "paid_only"
                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Paid & Done ({txPaidCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setCurrentPage(1);
                }}
                className={cn(
                  "relative px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer select-none",
                  statusFilter === "ALL"
                    ? "text-foreground bg-background shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({dateFilteredTransactions.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("cancelled");
                  setCurrentPage(1);
                }}
                className={cn(
                  "relative px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer select-none",
                  statusFilter === "cancelled"
                    ? "text-foreground bg-background shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Cancelled ({txCancelledCount})
              </button>
            </div>
          )}
        </div>

        {/* Row 2: One-Day Filter (when not custom) OR Custom Range Pickers (when custom), Status Filter, Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-1 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-2">
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

            {/* Status Dropdown Filter - Only applicable in Transactions mode */}
            {activeSubView === "transactions" && (
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
            )}

            {/* Sort Order Toggle */}
            <button
              onClick={() => {
                setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
                setCurrentPage(1);
              }}
              className="flex items-center gap-1.5 bg-muted/30 hover:bg-muted/50 border border-border/40 rounded-xl px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
              title="Click to toggle between Newest First and Oldest First"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
            </button>

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
              placeholder={activeSubView === "daywise" ? "Search date, day name…" : "Search customer, ID, file…"}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-7 h-8 text-xs bg-muted/30 border-border/40 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
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

                    return (
                      <TableRow
                        key={day.dateKey}
                        className={cn(
                          "group cursor-pointer hover:bg-muted/40 transition-colors h-14 border-b border-border/80 dark:border-border/60",
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
                        <TableCell className="font-semibold text-foreground py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {day.formattedDate}
                            </span>
                            {day.totalRevenue >= 50 && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                Peak Day
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Day Name */}
                        <TableCell className="text-xs text-muted-foreground font-medium py-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[11px] font-semibold border",
                              day.dayName === "Sun" || day.dayName === "Sat"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-muted/40 text-muted-foreground border-border/40"
                            )}
                          >
                            {day.dayName}
                          </span>
                        </TableCell>

                        {/* Total Transactions */}
                        <TableCell className="text-center font-mono text-xs font-semibold text-foreground py-3">
                          {day.transactionCount}
                        </TableCell>

                        {/* Successful Orders */}
                        <TableCell className="text-center py-3">
                          {day.successfulOrders > 0 ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                              <CheckCircle2 className="h-3 w-3" />
                              {day.successfulOrders}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground/60">
                              <XCircle className="h-3 w-3" />
                              0
                            </span>
                          )}
                        </TableCell>

                        {/* Pages Printed */}
                        <TableCell className="text-center font-mono text-xs text-muted-foreground py-3">
                          {day.pagesCount} pg
                        </TableCell>

                        {/* Daily Revenue */}
                        <TableCell className="py-3">
                          {day.totalRevenue > 0 ? (
                            <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                              ₹{day.totalRevenue.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="font-mono text-muted-foreground/50 text-sm font-medium">
                              ₹0
                            </span>
                          )}
                        </TableCell>

                        {/* Action Drilldown */}
                        <TableCell className="text-right pr-4 py-3">
                          <div className="inline-flex items-center justify-end">
                            {day.totalRevenue > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-foreground bg-muted/30 group-hover:bg-primary group-hover:text-primary-foreground border border-border/50 group-hover:border-primary/50 transition-all shadow-2xs">
                                <span>View {day.successfulOrders} {day.successfulOrders === 1 ? "Order" : "Orders"}</span>
                                <ArrowRight className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-transform group-hover:translate-x-0.5" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/60 group-hover:text-foreground transition-colors pr-1">
                                <span>{day.transactionCount} {day.transactionCount === 1 ? "attempt" : "attempts"}</span>
                                <ArrowRight className="h-3 w-3 opacity-40 group-hover:opacity-80 transition-transform group-hover:translate-x-0.5" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : activeSubView === "register" ? (
          /* ── Official University Register Logbook Table ── */
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/5 border-none">
                  <TableHead 
                    onClick={() => {
                      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
                      setCurrentPage(1);
                    }}
                    className="font-semibold text-muted-foreground/80 w-16 text-center px-2 cursor-pointer hover:text-foreground select-none"
                    title="Click to toggle S. No. order"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>S. No.</span>
                      <ArrowUpDown className="h-3 w-3 text-primary/70" />
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-24">Date</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 min-w-[140px]">Name</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-24">Course</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-36">UTR No.</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-20 text-center">Page Size</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-24 text-center">Colour Print</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-24 text-center">Colour Page</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-20 text-center">B&W Print</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-20 text-center">B&W Page</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-24 text-center">Total Pages</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 w-24 text-right pr-4">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={12} className="h-44 text-center text-xs text-muted-foreground">
                      No records match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const d = new Date(tx.createdAt);
                    const dateFormatted = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getFullYear()).slice(-2)}`;
                    const hasColor = (tx.colorPrints || tx.colorPages || 0) > 0;
                    const hasBw = (tx.bwPrints || tx.bwPages || 0) > 0;
                    const isExpanded = expandedId === tx.id;

                    return (
                      <React.Fragment key={tx.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40 transition-colors h-14 border-b border-border/80 dark:border-border/60"
                          onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                        >
                          {/* S. No. */}
                          <TableCell className="text-center font-mono text-xs font-semibold text-muted-foreground px-2">
                            {tx.registerSeqNumber ?? tx.seqNumber}
                          </TableCell>

                          {/* Date (DD-MM-YY) */}
                          <TableCell className="font-mono text-xs text-foreground whitespace-nowrap">
                            {dateFormatted}
                          </TableCell>

                          {/* Name */}
                          <TableCell>
                            <span className="text-xs font-semibold text-foreground truncate max-w-[160px] block" title={tx.name}>
                              {tx.name}
                            </span>
                          </TableCell>

                          {/* Course */}
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase bg-primary/10 text-primary border border-primary/20">
                              {tx.course || "CSDS"}
                            </span>
                          </TableCell>

                          {/* UTR No. */}
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                              <span className="truncate max-w-[120px] select-all font-semibold text-foreground">
                                {tx.utrNo || "—"}
                              </span>
                              {tx.utrNo && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(tx.utrNo!);
                                    setCopiedId(tx.utrNo!);
                                    setTimeout(() => setCopiedId(null), 1800);
                                  }}
                                  title="Copy UTR No."
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                  {copiedId === tx.utrNo ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </TableCell>

                          {/* Page Size */}
                          <TableCell className="text-center font-mono text-xs font-medium">
                            {tx.pageSize || "A4"}
                          </TableCell>

                          {/* Colour Print */}
                          <TableCell className="text-center font-mono text-xs">
                            {hasColor ? (
                              <span className="font-bold text-rose-600 dark:text-rose-400">{tx.colorPrints}</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </TableCell>

                          {/* Colour Page */}
                          <TableCell className="text-center font-mono text-xs">
                            {hasColor ? (
                              <span className="font-medium text-foreground">{tx.colorPages}</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </TableCell>

                          {/* B&W Print */}
                          <TableCell className="text-center font-mono text-xs">
                            {hasBw ? (
                              <span className="font-bold text-foreground">{tx.bwPrints}</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </TableCell>

                          {/* B&W Page */}
                          <TableCell className="text-center font-mono text-xs">
                            {hasBw ? (
                              <span className="font-medium text-foreground">{tx.bwPages}</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </TableCell>

                          {/* Total Pages */}
                          <TableCell className="text-center font-mono text-xs font-bold text-foreground">
                            {tx.totalPages}
                          </TableCell>

                          {/* Amount */}
                          <TableCell className="text-right pr-4 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            ₹{tx.amount.toFixed(0)}
                          </TableCell>
                        </TableRow>

                        {/* Expandable item details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <TableRow className="bg-muted/15 hover:bg-muted/15 border-b border-border/40">
                              <TableCell colSpan={12} className="p-3 pl-8">
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="space-y-2 text-xs"
                                >
                                  <div className="flex items-center gap-4 text-muted-foreground font-mono text-[11px] pb-1">
                                    <span>Task ID: <strong className="text-foreground">{tx.internalId}</strong></span>
                                    <span>Payment Status: <strong className="text-foreground capitalize">{tx.status}</strong></span>
                                    <span>Time: <strong className="text-foreground">{formatDateTime(tx.createdAt)}</strong></span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {tx.files.map((file, fIdx) => (
                                      <div
                                        key={fIdx}
                                        className="flex items-center gap-2 rounded-lg bg-card/80 border border-border/50 px-3 py-1.5 text-xs"
                                      >
                                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <span className="font-medium text-foreground truncate max-w-[200px]">
                                          {file.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                          ({file.copies} {file.copies === 1 ? "page" : "pages"}, {file.color ? "Colour" : "B&W"}, {file.paperSize || "A4"})
                                        </span>
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
        ) : (
          /* ── Individual Transactions Table ── */
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 dark:bg-muted/20 hover:bg-muted/30 border-none">
                  <TableHead className="font-semibold text-muted-foreground/80 w-32 px-4">Task ID</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80">Customer</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 hidden sm:table-cell">Payment Ref</TableHead>
                  <TableHead className="font-semibold text-muted-foreground/80 hidden sm:table-cell">UTR No.</TableHead>
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
                    <TableCell colSpan={9} className="h-44 text-center text-xs text-muted-foreground">
                      No transactions match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isExpanded = expandedId === tx.id;

                    return (
                      <React.Fragment key={tx.id}>
                        <TableRow
                          className={cn(
                            "cursor-pointer hover:bg-muted/40 transition-all h-16 border-b border-border/80 dark:border-border/60",
                            isExpanded && "bg-muted/20",
                            (tx.status === "cancelled" || tx.status === "failed") && "opacity-65 hover:opacity-100 transition-opacity"
                          )}
                          onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                        >
                          {/* Task ID (RU-xxxx) */}
                          <TableCell className="px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-foreground bg-muted/60 dark:bg-muted/40 border border-border/60 px-2.5 py-1 rounded-lg select-all">
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
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/70 text-foreground border border-border/50 text-xs font-bold">
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

                          {/* UTR No. */}
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[120px] select-all font-semibold text-foreground" title={tx.utrNo || ""}>
                                {tx.utrNo || "—"}
                              </span>
                              {tx.utrNo && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(tx.utrNo!);
                                    setCopiedId(tx.utrNo!);
                                    setTimeout(() => setCopiedId(null), 1800);
                                  }}
                                  title="Copy UTR No."
                                  className="p-1 rounded hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                  {copiedId === tx.utrNo ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              )}
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
                              {tx.amount > 0 ? (
                                <>
                                  <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                                    ₹{tx.amount}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    UPI / GPay
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="font-mono text-muted-foreground/60 text-sm font-medium">
                                    ₹0
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/50">
                                    Unpaid
                                  </span>
                                </>
                              )}
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
                              <TableCell colSpan={9} className="p-0 border-none">
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
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-card/60 border border-border/40 px-3.5 py-2.5 text-xs"
                                      >
                                        <div className="flex flex-col gap-1.5 min-w-0">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="h-4 w-4 text-primary shrink-0" />
                                            <span className="font-semibold text-foreground truncate" title={file.name}>
                                              {file.name}
                                            </span>
                                          </div>

                                          {/* Specifications */}
                                          {/* Specifications: Clean dot-separated metadata line (Option 1) */}
                                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground pt-0.5">
                                            {/* Paper Size */}
                                            <span className="font-mono font-medium text-foreground">
                                              {file.paperSize || "A4"}
                                            </span>

                                            <span className="text-muted-foreground/35 select-none font-bold">·</span>

                                            {/* Color Mode */}
                                            {file.color ? (
                                              <span className="font-semibold text-rose-600 dark:text-rose-400">
                                                Colour
                                              </span>
                                            ) : (
                                              <span>B&amp;W</span>
                                            )}

                                            <span className="text-muted-foreground/35 select-none font-bold">·</span>

                                            {/* Duplex / Two-Sided */}
                                            {file.duplex ? (
                                              <span className="font-semibold text-primary">
                                                2-Sided (Duplex)
                                              </span>
                                            ) : (
                                              <span>1-Sided</span>
                                            )}

                                            <span className="text-muted-foreground/35 select-none font-bold">·</span>

                                            {/* Orientation */}
                                            <span className="capitalize">
                                              {file.layout === "landscape" ? "Landscape" : "Portrait"}
                                            </span>

                                            <span className="text-muted-foreground/35 select-none font-bold">·</span>

                                            {/* Copies */}
                                            <span className={cn(file.copies > 1 && "font-semibold text-foreground font-mono")}>
                                              {file.copies} {file.copies === 1 ? "copy" : "copies"}
                                            </span>

                                            <span className="text-muted-foreground/35 select-none font-bold">·</span>

                                            {/* Pages per sheet */}
                                            <span className={cn((file.pagesPerSheet || 1) > 1 && "font-semibold text-purple-600 dark:text-purple-400")}>
                                              {file.pagesPerSheet || 1}-Up
                                            </span>

                                            <span className="text-muted-foreground/35 select-none font-bold">·</span>

                                            {/* Page Range */}
                                            <span className={cn(file.pageRange && file.pageRange !== "all" && "font-semibold text-amber-600 dark:text-amber-400 font-mono")}>
                                              {file.pageRange && file.pageRange !== "all" ? `Pages: ${file.pageRange}` : "All pages"}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                          <Badge variant="outline" className="text-[10px] capitalize">
                                            {file.status}
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
        )}

        {/* Pagination bar for transactions and register views */}
        {(activeSubView === "transactions" || activeSubView === "register") && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/60 bg-card/20 shrink-0">
            <div className="text-[11px] font-medium text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, displayTransactions.length)} of{" "}
              {displayTransactions.length} {activeSubView === "register" ? "logbook entries" : "transactions"}
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

      {/* Export Report Configuration Modal */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allTransactions={transactions}
        initialFormat={activeSubView === "register" ? "register" : "audit"}
      />
    </div>
  );
}
