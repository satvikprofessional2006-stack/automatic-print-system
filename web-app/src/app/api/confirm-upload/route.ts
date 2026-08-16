import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json();
    const { jobId } = body;
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    // Mark job as queued so the daemon can pick it up
    const { data: printJob, error: dbError } = await supabase
      .from('PrintJob')
      .update({ status: 'queued', updatedAt: new Date().toISOString() })
      .eq('id', jobId)
      .select()
      .single();
      
    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'DB_ERROR: ' + JSON.stringify(dbError) }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, id: printJob.id });
    
  } catch (error: any) {
    console.error('Confirm upload error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
