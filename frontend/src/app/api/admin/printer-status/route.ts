import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export interface PrinterSupply {
  name: string;
  level: number;
  color: string;
  type: string;
  isLow: boolean;
}

export interface ConnectedPrinterInfo {
  id: string;
  name: string;
  state: 'idle' | 'printing' | 'standby' | 'offline';
  statusText: string;
  isConnected: boolean;
  supplies: PrinterSupply[];
}

let cachedPrinter: ConnectedPrinterInfo | null = null;
let lastFetchTime = 0;

export async function GET(req: Request) {
  try {
    const now = Date.now();
    if (cachedPrinter && now - lastFetchTime < 3000) {
      return NextResponse.json({
        connectedPrinter: cachedPrinter,
        timestamp: new Date().toISOString(),
      });
    }

    // 1. Detect all registered CUPS printers
    let defaultPrinterId = '';
    try {
      const defRes = execSync('lpstat -d', { timeout: 1500 }).toString();
      if (defRes.includes('destination: ')) {
        defaultPrinterId = defRes.split('destination: ')[1].trim();
      }
    } catch {}

    let allPrinters: string[] = [];
    try {
      const pRes = execSync('lpstat -p', { timeout: 1500 }).toString();
      allPrinters = (pRes.match(/printer\s+([^\s]+)/gi) || []).map((p) =>
        p.replace(/printer\s+/i, '').trim()
      );
    } catch {}

    if (defaultPrinterId && !allPrinters.includes(defaultPrinterId)) {
      allPrinters.unshift(defaultPrinterId);
    }

    if (allPrinters.length === 0) {
      allPrinters = [process.env.PRINTER_NAME || 'Canon_MF280_Series_2'];
    }

    // 2. Check each printer to find if ANY printer is genuinely connected & online
    let chosenPrinterId = defaultPrinterId || allPrinters[0];
    let isConnected = false;
    let state: ConnectedPrinterInfo['state'] = 'offline';
    let statusText = 'No Printer Connected (Offline)';

    for (const pid of allPrinters) {
      let statOut = '';
      try {
        statOut = execSync(`lpstat -l -p ${pid}`, { timeout: 1500 }).toString();
      } catch (e: any) {
        statOut = e.stdout ? e.stdout.toString() : '';
      }

      const isOffline =
        statOut.includes('offline-report') ||
        statOut.includes('Unable to locate') ||
        statOut.includes('Looking for printer') ||
        statOut.includes('connecting-to-device') ||
        statOut.toLowerCase().includes('disabled') ||
        !statOut.trim();

      const isPrinting = statOut.toLowerCase().includes('now printing') && !isOffline;

      if (!isOffline) {
        chosenPrinterId = pid;
        isConnected = true;
        if (isPrinting) {
          state = 'printing';
          statusText = 'Printing Active';
        } else {
          state = 'idle';
          statusText = 'Connected & Ready';
        }
        break; // Found an active, connected printer
      }
    }

    // If none are online, default to the system default printer or first configured printer
    if (!isConnected) {
      chosenPrinterId = defaultPrinterId || allPrinters[0] || 'Canon_MF280_Series_2';
      state = 'offline';
      statusText = 'Printer Disconnected / Offline';
    }

    const displayName = chosenPrinterId.replace(/_/g, ' ');

    // 3. Query marker/toner levels via IPP only if printer is responsive
    let supplies: PrinterSupply[] = [];
    if (isConnected) {
      try {
        const ippOut = execSync(
          `ipptool -tv -T 2 ipp://localhost:631/printers/${chosenPrinterId} /usr/share/cups/ipptool/get-printer-attributes.test`,
          { timeout: 3500 }
        ).toString();

        const getAttr = (attr: string) => {
          const m = ippOut.match(new RegExp(attr + '\\s+\\([^)]+\\)\\s+=\\s+(.+)', 'i'));
          return m ? m[1].trim() : null;
        };

        const names = (getAttr('marker-names') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const levels = (getAttr('marker-levels') || '')
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        const colors = (getAttr('marker-colors') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const types = (getAttr('marker-types') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        supplies = names.map((name, i) => {
          let cleanName = name;
          if (cleanName.endsWith('Magenta To')) cleanName = 'Canon NPG-88 Magenta Toner';
          if (cleanName.endsWith('Yellow Ton')) cleanName = 'Canon NPG-88 Yellow Toner';

          const lvl = levels[i] !== undefined ? Math.max(0, Math.min(100, levels[i])) : 100;
          return {
            name: cleanName,
            level: lvl,
            color: colors[i] || '#000000',
            type: types[i] || 'toner',
            isLow: lvl <= 15,
          };
        });
      } catch {}
    }

    // If offline and no supplies queried, display status-appropriate info
    if (supplies.length === 0) {
      supplies = [
        {
          name: 'Cartridge / Toner Gauge',
          level: isConnected ? 100 : 0,
          color: '#000000',
          type: 'toner',
          isLow: !isConnected,
        },
      ];
    }

    cachedPrinter = {
      id: chosenPrinterId,
      name: displayName,
      state,
      statusText,
      isConnected,
      supplies,
    };
    lastFetchTime = now;

    return NextResponse.json({
      connectedPrinter: cachedPrinter,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (cachedPrinter) {
      return NextResponse.json({
        connectedPrinter: cachedPrinter,
        timestamp: new Date().toISOString(),
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
