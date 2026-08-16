import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: job, error } = await supabase
      .from('PrintJob')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    let position = 0;
    if (job.status === 'queued') {
      const { count } = await supabase
        .from('PrintJob')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued')
        .lt('createdAt', job.createdAt);
      
      position = (count || 0) + 1; // +1 because position is 1-indexed
    }
    
    return NextResponse.json({ ...job, position });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
