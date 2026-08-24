import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.PRINT_SERVER_SECRET || 'dev-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status } = body;

    if (!['printing', 'completed', 'failed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: job, error } = await supabase
      .from('PrintJob')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    if (status === 'completed' || status === 'failed') {
      const ext = job.filename.split('.').pop();
      const storageFilename = `${job.id}.${ext}`;
      
      const { error: deleteError } = await supabase
        .storage
        .from('print-jobs')
        .remove([storageFilename]);
        
      if (deleteError) {
        console.error(`Failed to delete file ${storageFilename} from storage:`, deleteError);
      }
    }
    
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
