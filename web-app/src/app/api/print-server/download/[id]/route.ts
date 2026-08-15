import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.PRINT_SERVER_SECRET || 'dev-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await prisma.printJob.findUnique({
      where: { id: params.id }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    const filepath = path.join(uploadDir, `${job.id}.pdf`);
    
    const fileBuffer = await fs.readFile(filepath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${job.filename}"`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error or file missing' }, { status: 500 });
  }
}
