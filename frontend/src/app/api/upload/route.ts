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
    const doubleSidedStr = formData.get('doubleSided') as string;
    const colorStr = formData.get('color') as string;
    const layout = (formData.get('layout') as string) || 'portrait';
    const paperSize = ((formData.get('paperSize') as string) || 'A4').toUpperCase();
    const pageRange = (formData.get('pageRange') as string) || 'all';
    const userName = formData.get('userName') as string || null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    const originalFilename = file.name;
    const ext = path.extname(originalFilename).toLowerCase();
    
    const isPDF = file.type === 'application/pdf' || ext === '.pdf';
    const isImage = file.type.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.heic', '.heif'].includes(ext);
    
    if (!isPDF && !isImage) {
      return NextResponse.json({ error: 'Only PDF and image files are allowed' }, { status: 400 });
    }
    
    const copies = parseInt(copiesStr || '1', 10);
    const doubleSided = doubleSidedStr === 'true';
    const isColor = colorStr === 'true';
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Generate UUID manually since we bypassed Prisma's auto-generation
    const jobId = crypto.randomUUID();
    
    // Create DB entry payload
    const jobPayload: any = {
      id: jobId,
      filename: originalFilename,
      copies: copies,
      status: 'queued',
      userName: userName,
      doubleSided: doubleSided,
      color: isColor,
      layout: layout,
      paper_size: paperSize,
      page_range: pageRange,
      updatedAt: new Date().toISOString()
    };

    // Create DB entry to get the UUID using Supabase JS
    let { data: printJob, error: dbError } = await supabase
      .from('PrintJob')
      .insert([jobPayload])
      .select()
      .single();

    // If optional columns ('color', 'layout', 'paper_size', 'page_range') don't exist yet in Supabase schema, retry safely without throwing
    if (dbError && (dbError.message?.includes('color') || dbError.message?.includes('layout') || dbError.message?.includes('paper_size') || dbError.message?.includes('page_range') || dbError.details?.includes('column') || dbError.code === 'PGRST204')) {
      console.warn("Retrying insert without optional columns:", dbError.message);
      delete jobPayload.color;
      delete jobPayload.layout;
      delete jobPayload.paper_size;
      delete jobPayload.page_range;
      const retryResult = await supabase
        .from('PrintJob')
        .insert([jobPayload])
        .select()
        .single();
      printJob = retryResult.data;
      dbError = retryResult.error;
    }
      
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
