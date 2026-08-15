import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.PRINT_SERVER_SECRET || 'dev-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await prisma.printJob.findUnique({
      where: { id }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    const ext = path.extname(job.filename).toLowerCase();
    const filepath = path.join(uploadDir, `${job.id}${ext}`);
    
    const fileBuffer = await fs.readFile(filepath);
    
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/pdf';
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${job.filename}"`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error or file missing' }, { status: 500 });
  }
}
