import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const job = await prisma.printJob.findUnique({
      where: { id: params.id }
    });
    
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    let position = 0;
    if (job.status === 'queued') {
      // Find how many queued jobs were created before this one
      position = await prisma.printJob.count({
        where: {
          status: 'queued',
          createdAt: {
            lt: job.createdAt
          }
        }
      }) + 1; // +1 because position is 1-indexed
    }
    
    return NextResponse.json({ ...job, position });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
