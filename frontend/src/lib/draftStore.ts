/**
 * IndexedDB and localStorage storage utility for persisting active print drafts
 * across browser refreshes, tab discards, and mobile memory reloads.
 */

import { PrintFile, PrintJob, UserType, calcFilesAmount } from "@/lib/printStore";

const DB_NAME = "ru_draft_cache_db";
const DB_VERSION = 1;
const STORE_NAME = "draft_session";
const DRAFT_KEY = "current_draft";
const DRAFT_META_KEY = "ru_draft_meta";
export const DRAFT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface CachedDraftFile {
  name: string;
  size: number;
  type: string;
  fileBlob: Blob;
  settings?: any;
}

export interface CachedDraftSession {
  id: string; // "current_draft"
  step: "details" | "options" | "preview" | "payment";
  timestamp: number;
  name: string;
  enrollmentNo: string;
  userType?: UserType;
  files: CachedDraftFile[];
  activeJob?: Omit<PrintJob, "files"> | null;
}

export interface RestoredDraftResult {
  step: "details" | "options" | "preview" | "payment";
  name: string;
  enrollmentNo: string;
  files: PrintFile[];
  activeJob: PrintJob | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Synchronous check via localStorage to immediately tell page.tsx
 * if an active draft exists, so it can skip the 3D printer intro animation on refresh.
 */
export function hasActiveDraftSync(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const rawMeta = localStorage.getItem(DRAFT_META_KEY);
    if (!rawMeta) return false;
    const meta = JSON.parse(rawMeta);
    const isFresh = meta.timestamp && Date.now() - meta.timestamp < DRAFT_TTL_MS;
    return Boolean(isFresh && meta.hasFiles);
  } catch {
    return false;
  }
}

/**
 * Saves current draft session, files, settings, and active step to IndexedDB.
 */
export async function saveDraftSession(data: {
  step: "details" | "options" | "preview" | "payment";
  name: string;
  enrollmentNo: string;
  userType?: UserType;
  files: PrintFile[];
  activeJob?: PrintJob | null;
}): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    // If there are no files, clear the draft instead of keeping an empty draft
    if (!data.files || data.files.length === 0) {
      await clearDraftSession();
      return;
    }

    const cachedFiles: CachedDraftFile[] = data.files.map((pf) => ({
      name: pf.name,
      size: pf.size,
      type: pf.type || "application/pdf",
      fileBlob: pf.file,
      settings: pf.settings,
    }));

    let jobMeta: Omit<PrintJob, "files"> | null = null;
    if (data.activeJob) {
      const { files: _, ...restJob } = data.activeJob;
      jobMeta = restJob;
    }

    const payload: CachedDraftSession = {
      id: DRAFT_KEY,
      step: data.step,
      timestamp: Date.now(),
      name: data.name,
      enrollmentNo: data.enrollmentNo,
      userType: data.userType,
      files: cachedFiles,
      activeJob: jobMeta,
    };

    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(payload);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Update synchronous localStorage metadata
    localStorage.setItem(
      DRAFT_META_KEY,
      JSON.stringify({
        timestamp: payload.timestamp,
        hasFiles: cachedFiles.length > 0,
        step: data.step,
      })
    );
  } catch (err) {
    console.warn("Failed to save draft to IndexedDB:", err);
  }
}

/**
 * Retrieves and reconstructs the active draft session.
 */
export async function getDraftSession(): Promise<RestoredDraftResult | null> {
  if (typeof window === "undefined") return null;

  try {
    const db = await openDB();
    const draft = await new Promise<CachedDraftSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DRAFT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!draft || !draft.files || draft.files.length === 0) {
      return null;
    }

    // Check expiry TTL (4 hours)
    if (Date.now() - draft.timestamp > DRAFT_TTL_MS) {
      await clearDraftSession();
      return null;
    }

    // Reconstruct File objects from Blobs
    const restoredFiles: PrintFile[] = draft.files.map((cf) => ({
      name: cf.name,
      size: cf.size,
      type: cf.type || "application/pdf",
      file: new File([cf.fileBlob], cf.name, {
        type: cf.type || "application/pdf",
        lastModified: Date.now(),
      }),
      settings: cf.settings,
    }));

    let restoredJob: PrintJob | null = null;
    if (draft.activeJob) {
      restoredJob = {
        ...draft.activeJob,
        files: restoredFiles,
      };
    } else if (draft.step !== "details") {
      const { totalPages, totalAmount } = calcFilesAmount(restoredFiles);
      restoredJob = {
        id: Math.random().toString(36).slice(2, 10).toUpperCase(),
        userType: draft.userType || "student",
        name: draft.name,
        enrollmentNo: draft.enrollmentNo,
        files: restoredFiles,
        totalPages,
        amount: totalAmount,
        status: "pending_payment",
        createdAt: new Date(draft.timestamp).toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      step: draft.step,
      name: draft.name || "",
      enrollmentNo: draft.enrollmentNo || "",
      files: restoredFiles,
      activeJob: restoredJob,
    };
  } catch (err) {
    console.warn("Failed to get draft session from IndexedDB:", err);
    return null;
  }
}

/**
 * Completely clears the saved draft session from IndexedDB and localStorage.
 */
export async function clearDraftSession(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(DRAFT_META_KEY);
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(DRAFT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to clear draft from IndexedDB:", err);
  }
}
