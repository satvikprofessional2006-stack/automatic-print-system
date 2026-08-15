import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

    const ext = path.extname(job.filename).toLowerCase();
    const filename = `${job.id}${ext}`;
    
    if (!supabaseUrl || !supabaseKey) {
       return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Generate a signed URL valid for 60 seconds
    const { data, error } = await supabase
      .storage
      .from('print-jobs')
      .createSignedUrl(filename, 60);
      
    if (error || !data) {
      console.error('Supabase signed URL error:', error);
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    // Redirect the Python daemon to the signed URL so it can download directly
    return NextResponse.redirect(data.signedUrl);
    
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
