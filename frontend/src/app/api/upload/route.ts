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
    const pagesPerSheetStr = formData.get('pagesPerSheet') as string;
    const pagesPerSheet = parseInt(pagesPerSheetStr || '1', 10);
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
    
    const isAdminUpload = (userName || '').toLowerCase().includes('admin');
    const initialStatus = isAdminUpload ? 'queued' : 'paid';

    // Create DB entry payload
    const jobPayload: any = {
      id: jobId,
      filename: originalFilename,
      copies: copies,
      status: initialStatus,
      userName: userName,
      doubleSided: doubleSided,
      color: isColor,
      layout: layout,
      paper_size: paperSize,
      pages_per_sheet: pagesPerSheet > 1 ? pagesPerSheet : 1,
      page_range: pageRange,
      updatedAt: new Date().toISOString()
    };

    // Resilient database insertion: dynamically strip any column that does not exist in Supabase schema
    let printJob: any = null;
    let dbError: any = null;
    const currentPayload: any = { ...jobPayload };

    for (let attempt = 0; attempt < 8; attempt++) {
      const result = await supabase
        .from('PrintJob')
        .insert([currentPayload])
        .select()
        .single();

      if (!result.error) {
        printJob = result.data;
        dbError = null;
        break;
      }

      dbError = result.error;
      const errorMsg = dbError.message || JSON.stringify(dbError);

      // Check if a specific column is missing from Supabase schema
      const colMatch = errorMsg.match(/Could not find the '([^']+)' column/i);
      if (colMatch && colMatch[1]) {
        const missingCol = colMatch[1];
        console.warn(`Column '${missingCol}' missing from PrintJob schema. Stripping and retrying.`);
        delete currentPayload[missingCol];
        continue;
      }

      // If generic PGRST204 or column error, strip all non-core columns
      if (dbError.code === 'PGRST204' || errorMsg.includes('column')) {
        console.warn("Stripping all optional print options and retrying with base schema:", errorMsg);
        delete currentPayload.doubleSided;
        delete currentPayload.double_sided;
        delete currentPayload.color;
        delete currentPayload.layout;
        delete currentPayload.paper_size;
        delete currentPayload.pages_per_sheet;
        delete currentPayload.page_range;
        delete currentPayload.userName;

        const fallbackResult = await supabase
          .from('PrintJob')
          .insert([currentPayload])
          .select()
          .single();

        if (!fallbackResult.error) {
          printJob = fallbackResult.data;
          dbError = null;
          break;
        }
        dbError = fallbackResult.error;
        break;
      }

      // If it's a completely different DB error, stop looping
      break;
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
