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

    // 1. Detect default / connected printer dynamically from system
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
      printerId = process.env.PRINTER_NAME || 'Canon_MF280_Series_2';
    }

    let displayName = printerId.replace(/_/g, ' ');

    // 2. Determine actual live connection status
    let statOut = '';
    try {
      statOut = execSync(`lpstat -l -p ${printerId}`, { timeout: 1500 }).toString();
    } catch (e: any) {
      statOut = e.stdout ? e.stdout.toString() : '';
    }

    const isOffline =
      statOut.includes('offline-report') ||
      statOut.includes('Unable to locate') ||
      statOut.includes('Looking for printer') ||
      statOut.includes('connecting-to-device') ||
      statOut.toLowerCase().includes('disabled');

    const isPrinting = statOut.toLowerCase().includes('now printing') && !isOffline;

    let state: ConnectedPrinterInfo['state'] = 'idle';
    let statusText = 'Connected & Online';
    let isConnected = true;

    if (isOffline) {
      state = 'offline';
      statusText = 'Printer Disconnected / Offline';
      isConnected = false;
    } else if (isPrinting) {
      state = 'printing';
      statusText = 'Printing Active';
      isConnected = true;
    } else {
      state = 'idle';
      statusText = 'Connected & Ready';
      isConnected = true;
    }

    // 3. Query marker/toner levels via IPP
    let supplies: PrinterSupply[] = [];
    try {
      const ippOut = execSync(
        `ipptool -tv -T 2 ipp://localhost:631/printers/${printerId} /usr/share/cups/ipptool/get-printer-attributes.test`,
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
    } catch {
      // Retain previous cached supplies if available
      if (cachedPrinter && cachedPrinter.id === printerId && cachedPrinter.supplies.length > 0) {
        supplies = cachedPrinter.supplies;
      }
    }

    // If supplies array is empty
    if (supplies.length === 0) {
      supplies = [
        {
          name: 'Canon Cartridge 072 Black Toner',
          level: 15,
          color: '#000000',
          type: 'toner',
          isLow: true,
        },
      ];
    }

    cachedPrinter = {
      id: printerId,
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
