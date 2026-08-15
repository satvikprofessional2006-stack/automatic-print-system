import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD || 'admin'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: job, error } = await supabase
      .from('PrintJob')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    
    // Cleanup: delete the actual file from Supabase Storage since it won't be printed
    if (job.filename) {
      const ext = job.filename.substring(job.filename.lastIndexOf('.')).toLowerCase();
      const storageFilename = `${job.id}${ext}`;
      await supabase.storage.from('print-jobs').remove([storageFilename]);
    }
    
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
