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
  isOnline: boolean;
  supplies: PrinterSupply[];
}

// In-memory cache to ensure instant UI responses if printer sleeps
let cachedPrinter: ConnectedPrinterInfo | null = null;
let lastFetchTime = 0;

export async function GET(req: Request) {
  try {
    const now = Date.now();
    // Return cache if fetched within last 4 seconds
    if (cachedPrinter && now - lastFetchTime < 4000) {
      return NextResponse.json({
        connectedPrinter: cachedPrinter,
        timestamp: new Date().toISOString(),
      });
    }

    // 1. Detect connected / default printer dynamically from system
    let printerId = '';
    try {
      const defRes = execSync('lpstat -d', { timeout: 1500 }).toString();
      if (defRes.includes('destination: ')) {
        printerId = defRes.split('destination: ')[1].trim();
      }
    } catch {}

    if (!printerId) {
      try {
        const pRes = execSync('lpstat -p', { timeout: 1500 }).toString();
        const match = pRes.match(/printer\s+([^\s]+)/i);
        if (match) printerId = match[1];
      } catch {}
    }

    if (!printerId) {
      // Fallback if no printer found in CUPS
      return NextResponse.json({
        connectedPrinter: null,
        message: 'No printer connected to system',
        timestamp: new Date().toISOString(),
      });
    }

    let displayName = printerId.replace(/_/g, ' ');
    let state: ConnectedPrinterInfo['state'] = 'idle';
    let statusText = 'Ready & Spooling';
    let isOnline = true;

    // Check status via lpstat
    try {
      const statOut = execSync(`lpstat -p ${printerId}`, { timeout: 1500 }).toString();
      if (statOut.toLowerCase().includes('now printing')) {
        state = 'printing';
        statusText = 'Printing Active';
      } else if (
        statOut.toLowerCase().includes('looking for printer') ||
        statOut.toLowerCase().includes('unable to locate')
      ) {
        state = 'standby';
        statusText = 'Connected (Standby)';
      }
    } catch {}

    // 2. Query marker/toner supplies via IPP
    let supplies: PrinterSupply[] = [];
    try {
      const ippOut = execSync(
        `ipptool -tv -T 3 ipp://localhost:631/printers/${printerId} /usr/share/cups/ipptool/get-printer-attributes.test`,
        { timeout: 4000 }
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
    } catch (ippErr: any) {
      // If IPP timed out this turn, preserve previous cached supplies if available
      if (cachedPrinter && cachedPrinter.id === printerId && cachedPrinter.supplies.length > 0) {
        supplies = cachedPrinter.supplies;
      }
    }

    cachedPrinter = {
      id: printerId,
      name: displayName,
      state,
      statusText,
      isOnline,
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
