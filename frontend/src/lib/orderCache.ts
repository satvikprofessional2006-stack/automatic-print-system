/**
 * IndexedDB storage utility for preserving print job files and metadata across
 * browser tab discards / OS memory pressure reloads on low-end mobile devices.
 */

const DB_NAME = "ru_print_cache_db";
const DB_VERSION = 1;
const STORE_NAME = "pending_orders";

export interface CachedPendingOrder {
  orderId: string;
  jobId: string;
  name: string;
  enrollmentNo?: string;
  email?: string;
  userType?: string;
  totalPages: number;
  amount: number;
  timestamp: number;
  files: {
    name: string;
    size: number;
    type: string;
    fileBlob: Blob;
    settings?: any;
  }[];
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
        db.createObjectStore(STORE_NAME, { keyPath: "orderId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a pending print order along with binary file Blobs to device disk storage (IndexedDB).
 */
export async function savePendingOrderToCache(order: CachedPendingOrder): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(order);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to save pending order to IndexedDB:", err);
  }
}

/**
 * Retrieves a cached pending order by Razorpay orderId.
 */
export async function getPendingOrderFromCache(orderId: string): Promise<CachedPendingOrder | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(orderId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to get pending order from IndexedDB:", err);
    return null;
  }
}

/**
 * Removes a cached pending order after successful upload or cancellation.
 */
export async function clearPendingOrderFromCache(orderId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(orderId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to delete pending order from IndexedDB:", err);
  }
}

/**
 * Clean up stale pending orders older than 2 hours.
 */
export async function pruneStalePendingOrders(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    req.onsuccess = (e: any) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.timestamp && cursor.value.timestamp < twoHoursAgo) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (err) {
    // Non-fatal
  }
}
