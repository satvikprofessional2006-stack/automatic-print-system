import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Initialize Supabase client using Service Role Key to bypass RLS for uploads
export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const copiesStr = formData.get('copies') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only PDF and image files are allowed' }, { status: 400 });
    }
    
    const copies = parseInt(copiesStr || '1', 10);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const originalFilename = file.name;
    const ext = path.extname(originalFilename).toLowerCase();
    
    // Generate UUID manually since we bypassed Prisma's auto-generation
    const jobId = crypto.randomUUID();
    
    // Create DB entry to get the UUID using Supabase JS
    const { data: printJob, error: dbError } = await supabase
      .from('PrintJob')
      .insert([
        {
          id: jobId,
          filename: originalFilename,
          copies: copies,
          status: 'queued',
          updatedAt: new Date().toISOString()
        }
      ])
      .select()
      .single();
      
    if (dbError || !printJob) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'DB_ERROR: ' + JSON.stringify(dbError) }, { status: 500 });
    }
    
    // Save file to Supabase Storage with job ID and extension
    const filename = `${printJob.id}${ext}`;
    
    if (supabaseUrl && supabaseKey) {
      const { error: uploadError } = await supabase
        .storage
        .from('print-jobs')
        .upload(filename, buffer, {
          contentType: file.type,
          upsert: true
        });
        
      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error('Failed to upload file to cloud storage');
      }
    } else {
      console.warn("Supabase keys not found. Skipping file upload.");
    }
    
    return NextResponse.json({ id: printJob.id });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
