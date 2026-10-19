import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes UTC ISO strings from Postgres / Supabase timestamp columns.
 * Postgres `timestamp without time zone` columns often return without a trailing 'Z'
 * (e.g. '2026-10-18T21:25:13.68'), which causes JS `new Date()` to treat it as local time
 * instead of UTC. This ensures it is always parsed as UTC.
 */
export function parseUtcDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  const s = String(val).trim();
  if (s.endsWith("Z") || s.includes("+")) {
    return new Date(s);
  }
  return new Date(`${s}Z`);
}

/**
 * Formats date/time in Indian Standard Time (IST, UTC+5:30)
 */
export function formatIndianDateTime(isoOrDate: any, includeSeconds = false): string {
  const d = parseUtcDate(isoOrDate);
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: true,
  });
}

export function formatIndianTimeOnly(isoOrDate: any): string {
  const d = parseUtcDate(isoOrDate);
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Returns "YYYY-MM-DD" in Indian Standard Time (IST, UTC+5:30)
 */
export function toLocalDateKey(d: any): string {
  const dateObj = parseUtcDate(d);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
}

/**
 * Returns today's "YYYY-MM-DD" key in Indian Standard Time (IST, UTC+5:30)
 */
export function getTodayDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

