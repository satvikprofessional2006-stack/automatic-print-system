import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    // Basic auth check using a hardcoded token for the print server
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.PRINT_SERVER_SECRET || 'dev-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the oldest queued job
    const { data: jobs, error } = await supabase
      .from('PrintJob')
      .select('*')
      .eq('status', 'queued')
      .order('createdAt', { ascending: true })
      .limit(1);

    if (error) throw error;
    
    const job = jobs && jobs.length > 0 ? jobs[0] : null;

    if (!job) {
      return NextResponse.json({ job: null });
    }
    
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
