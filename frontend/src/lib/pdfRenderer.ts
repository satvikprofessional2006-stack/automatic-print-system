// Clean PDF page renderer using PDF.js to render crisp image snapshots for preview
// Eliminates browser iframe PDF quirks, dark letterboxing, and multi-page bleed.

let pdfjsLibInstance: any = null;
let scriptLoadingPromise: Promise<any> | null = null;

async function getPdfjs(): Promise<any> {
  if (typeof window === "undefined") return null;
  if ((window as any).pdfjsLib) {
    const lib = (window as any).pdfjsLib;
    if (lib && lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
    }
    return lib;
  }
  if (pdfjsLibInstance) return pdfjsLibInstance;

  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve) => {
    let checkInterval: any = null;
    let timeoutId: any = null;

    const cleanup = () => {
      if (checkInterval) clearInterval(checkInterval);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const done = (lib: any) => {
      cleanup();
      if (lib && lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      }
      pdfjsLibInstance = lib;
      resolve(lib);
    };

    if ((window as any).pdfjsLib) {
      done((window as any).pdfjsLib);
      return;
    }

    let script = document.querySelector('script[src="/pdf.min.js"]') as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.src = "/pdf.min.js";
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", () => {
      if ((window as any).pdfjsLib) {
        done((window as any).pdfjsLib);
      }
    });

    // Active polling interval in case the script is already running or completes without triggering the new listener
    checkInterval = setInterval(() => {
      if ((window as any).pdfjsLib) {
        done((window as any).pdfjsLib);
      }
    }, 40);

    // Timeout safety net (2000ms): try dynamic import if script tag fails
    timeoutId = setTimeout(async () => {
      cleanup();
      if ((window as any).pdfjsLib) {
        done((window as any).pdfjsLib);
        return;
      }
      try {
        const mod: any = await import("pdfjs-dist");
        const resolved = mod?.default?.getDocument ? mod.default : mod;
        done(resolved);
      } catch (e) {
        console.warn("PDF.js loading fallback error:", e);
        scriptLoadingPromise = null;
        resolve(null);
      }
    }, 2000);
  });

  return scriptLoadingPromise;
}

// In-memory document cache to avoid re-parsing large PDFs on every page turn
const docCache = new Map<string, any>();
const pageCache = new Map<string, { dataUrl: string; width: number; height: number; isLandscape: boolean }>();

export async function renderPdfPageToDataUrl(
  file: File,
  pageNum: number,
  scale: number = 1.6
): Promise<{ dataUrl: string; width: number; height: number; isLandscape: boolean } | null> {
  try {
    const fileKey = `${file.name}_${file.size}_${file.lastModified}`;
    const pageKey = `${fileKey}_p${pageNum}`;

    if (pageCache.has(pageKey)) {
      return pageCache.get(pageKey)!;
    }

    const pdfjs = await getPdfjs();
    if (!pdfjs) return null;

    let pdfDoc = docCache.get(fileKey);
    if (!pdfDoc) {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: "/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/standard_fonts/",
      });
      pdfDoc = await loadingTask.promise;
      docCache.set(fileKey, pdfDoc);
    }

    const totalPages = pdfDoc.numPages;
    if (pageNum < 1 || pageNum > totalPages) return null;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const isLandscape = viewport.width > viewport.height;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return null;

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const result = {
      dataUrl,
      width: viewport.width,
      height: viewport.height,
      isLandscape,
    };

    pageCache.set(pageKey, result);
    return result;
  } catch (err) {
    console.error("renderPdfPageToDataUrl failed for page", pageNum, err);
    return null;
  }
}

export async function countPdfPages(file: File): Promise<number> {
  try {
    const pdfjs = await getPdfjs();
    if (!pdfjs) return 1;
    const fileKey = `${file.name}_${file.size}_${file.lastModified}`;
    let pdfDoc = docCache.get(fileKey);
    if (!pdfDoc) {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: "/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/standard_fonts/",
      });
      pdfDoc = await loadingTask.promise;
      docCache.set(fileKey, pdfDoc);
    }
    return pdfDoc.numPages || 1;
  } catch (err) {
    console.error("countPdfPages failed:", err);
    return 1;
  }
}

export function clearPdfRenderCache() {
  docCache.clear();
  pageCache.clear();
}
