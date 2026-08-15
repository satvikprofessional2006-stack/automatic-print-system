import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const copiesStr = formData.get('copies') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }
    
    const copies = parseInt(copiesStr || '1', 10);
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }
    
    const originalFilename = file.name;
    // Create DB entry to get the UUID
    const printJob = await prisma.printJob.create({
      data: {
        filename: originalFilename,
        copies: copies,
        status: 'queued'
      }
    });
    
    // Save file with job ID
    const filename = `${printJob.id}.pdf`;
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, buffer);
    
    return NextResponse.json({ id: printJob.id });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
