import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json();
    const { filename, copies, userName } = body;
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }
    
    const ext = path.extname(filename).toLowerCase();
    const jobId = crypto.randomUUID();
    
    // Create DB entry first with status 'uploading'
    const { data: printJob, error: dbError } = await supabase
      .from('PrintJob')
      .insert([
        {
          id: jobId,
          filename: filename,
          copies: parseInt(copies || '1', 10),
          status: 'uploading',
          userName: userName || null,
          updatedAt: new Date().toISOString()
        }
      ])
      .select()
      .single();
      
    if (dbError || !printJob) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'DB_ERROR: ' + JSON.stringify(dbError) }, { status: 500 });
    }
    
    const storageFilename = `${printJob.id}${ext}`;
    
    // Generate Signed Upload URL
    const { data, error } = await supabase
      .storage
      .from('print-jobs')
      .createSignedUploadUrl(storageFilename);
      
    if (error || !data) {
      console.error('Signed URL error:', error);
      
      // Rollback DB entry if we can't get a signed URL
      await supabase.from('PrintJob').delete().eq('id', jobId);
      
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      id: printJob.id,
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path
    });
    
  } catch (error: any) {
    console.error('Get upload URL error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
