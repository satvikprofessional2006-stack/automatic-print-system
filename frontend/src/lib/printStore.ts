// ─── Print Job Types ──────────────────────────────────────────────────────────

export type UserType = "student" | "other";
export type JobStatus = "pending_payment" | "paid" | "printing" | "completed" | "failed";

export interface PrintFile {
  name: string;
  size: number;
  type: string;
  file: File;
  settings?: {
    color: boolean;
    copies: number;
    layout: string;
    pages: number;
    doubleSided: boolean;
    paperSize?: "A4" | "A3";
    pageRange?: string;          // "all", "odd", "even", or custom range like "1-3, 5"
    pageMode?: "all" | "odd" | "even" | "custom";
    selectedPagesCount?: number; // effective page count
  };
}

export interface PrintJob {
  id: string;           
  userType: UserType;
  name: string;
  enrollmentNo?: string; 
  files: PrintFile[];
  totalPages: number;   
  amount: number;       
  upiRef?: string;      
  status: JobStatus;
  createdAt: string;    
  updatedAt: string;
}

// Pricing Rates
export const BW_RATE = 2; // ₹2 per page for A4 Black & White
export const COLOR_RATE = 10; // ₹10 per page for A4 Colour
export const BW_A3_RATE = 5; // ₹5 per page for A3 Black & White
export const COLOR_A3_RATE = 20; // ₹20 per page for A3 Colour
export const MIN_JOB_AMOUNT = 0; // No minimum order fee

export interface AmountBreakdown {
  bwPages: number;
  colorPages: number;
  bwA3Pages: number;
  colorA3Pages: number;
  totalPages: number;
  bwAmount: number;
  colorAmount: number;
  bwA3Amount: number;
  colorA3Amount: number;
  totalAmount: number;
}

export interface PageRangeResult {
  valid: boolean;
  pages: number[];
  count: number;
  error?: string;
}

/**
 * Parses user input page range like "1-3, 5, 8" against a total page count
 */
export function parsePageRange(
  rangeStr: string | undefined,
  totalPages: number,
  pageMode?: "all" | "odd" | "even" | "custom"
): PageRangeResult {
  const safeTotal = Math.max(1, totalPages || 1);

  if (pageMode === "all") {
    const allPages = Array.from({ length: safeTotal }, (_, i) => i + 1);
    return { valid: true, pages: allPages, count: safeTotal };
  }

  if (pageMode === "odd" || (!pageMode && rangeStr?.toLowerCase() === "odd")) {
    const oddPages = Array.from({ length: safeTotal }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
    return { valid: true, pages: oddPages, count: oddPages.length };
  }

  if (pageMode === "even" || (!pageMode && rangeStr?.toLowerCase() === "even")) {
    const evenPages = Array.from({ length: safeTotal }, (_, i) => i + 1).filter((p) => p % 2 === 0);
    return {
      valid: evenPages.length > 0,
      pages: evenPages,
      count: evenPages.length,
      error: evenPages.length === 0 ? "No even pages found" : undefined,
    };
  }

  if (pageMode === "custom" && (!rangeStr || rangeStr.trim() === "")) {
    return {
      valid: false,
      pages: [],
      count: 0,
      error: "Please enter page numbers (e.g. 1-5, 8)",
    };
  }

  if (!rangeStr || rangeStr.trim().toLowerCase() === "all" || rangeStr.trim() === "") {
    const allPages = Array.from({ length: safeTotal }, (_, i) => i + 1);
    return { valid: true, pages: allPages, count: safeTotal };
  }

  const parts = rangeStr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    const allPages = Array.from({ length: safeTotal }, (_, i) => i + 1);
    return { valid: true, pages: allPages, count: safeTotal };
  }

  const selectedSet = new Set<number>();

  for (const part of parts) {
    if (part.includes("-")) {
      const sub = part.split("-").map((s) => s.trim());
      if (sub.length !== 2) {
        return { valid: false, pages: [], count: 0, error: `Invalid format: "${part}"` };
      }
      const start = parseInt(sub[0], 10);
      const end = parseInt(sub[1], 10);
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        return { valid: false, pages: [], count: 0, error: `Invalid range: "${part}"` };
      }
      if (end > safeTotal) {
        return { valid: false, pages: [], count: 0, error: `Page ${end} exceeds total pages (${safeTotal})` };
      }
      for (let p = start; p <= end; p++) {
        selectedSet.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (isNaN(p) || p < 1) {
        return { valid: false, pages: [], count: 0, error: `Invalid page: "${part}"` };
      }
      if (p > safeTotal) {
        return { valid: false, pages: [], count: 0, error: `Page ${p} exceeds total pages (${safeTotal})` };
      }
      selectedSet.add(p);
    }
  }

  const sortedPages = Array.from(selectedSet).sort((a, b) => a - b);
  return {
    valid: sortedPages.length > 0,
    pages: sortedPages,
    count: sortedPages.length,
    error: sortedPages.length === 0 ? "No pages selected" : undefined,
  };
}

/**
 * Calculates page count and cost breakdown across all uploaded files
 */
export function calcFilesAmount(files: PrintFile[]): AmountBreakdown {
  let bwPages = 0;
  let colorPages = 0;
  let bwA3Pages = 0;
  let colorA3Pages = 0;

  for (const f of files) {
    const docPages = f.settings?.pages || 1;
    const pageRange = f.settings?.pageRange;
    const pageMode = f.settings?.pageMode;
    const rangeRes = parsePageRange(pageRange, docPages, pageMode);
    const effectivePages = rangeRes.valid ? rangeRes.count : docPages;
    const pages = effectivePages * (f.settings?.copies || 1);
    const paperSize = f.settings?.paperSize || "A4";
    const isA3 = paperSize === "A3";

    if (isA3) {
      if (f.settings?.color) {
        colorA3Pages += pages;
      } else {
        bwA3Pages += pages;
      }
    } else {
      if (f.settings?.color) {
        colorPages += pages;
      } else {
        bwPages += pages;
      }
    }
  }

  const totalPages = bwPages + colorPages + bwA3Pages + colorA3Pages;
  const bwAmount = bwPages * BW_RATE;
  const colorAmount = colorPages * COLOR_RATE;
  const bwA3Amount = bwA3Pages * BW_A3_RATE;
  const colorA3Amount = colorA3Pages * COLOR_A3_RATE;
  const totalAmount = bwAmount + colorAmount + bwA3Amount + colorA3Amount;

  return {
    bwPages,
    colorPages,
    bwA3Pages,
    colorA3Pages,
    totalPages,
    bwAmount,
    colorAmount,
    bwA3Amount,
    colorA3Amount,
    totalAmount,
  };
}

/**
 * Calculate amount with backward compatibility for single page count or files array
 */
export function calcAmount(filesOrPages: PrintFile[] | number): number {
  if (Array.isArray(filesOrPages)) {
    return calcFilesAmount(filesOrPages).totalAmount;
  }
  if (!filesOrPages || filesOrPages <= 0) return 0;
  return filesOrPages * BW_RATE;
}
