import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    // Basic auth check using a hardcoded token for the print server
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.PRINT_SERVER_SECRET || 'dev-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the oldest queued job
    const job = await prisma.printJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' }
    });
    
    if (!job) {
      return NextResponse.json({ job: null });
    }
    
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
