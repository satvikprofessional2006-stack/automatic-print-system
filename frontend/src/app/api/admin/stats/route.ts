import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD || 'admin'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get total count
    const { count: totalCount } = await supabase
      .from('PrintJob')
      .select('*', { count: 'exact', head: true });

    // Get completed count
    const { count: doneCount } = await supabase
      .from('PrintJob')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Get queued + printing count
    const { count: queuedCount } = await supabase
      .from('PrintJob')
      .select('*', { count: 'exact', head: true })
      .in('status', ['queued', 'printing']);

    // Since 'amount' wasn't historically stored in the DB, we just estimate 
    // revenue based on the copies of completed/queued jobs, assuming a base rate of Rs. 2 per copy (if that was the rate).
    // Or we just return 0 for now until the DB schema adds an amount column.
    
    return NextResponse.json({
      total: totalCount || 0,
      done: doneCount || 0,
      inQueue: queuedCount || 0,
      revenue: 0 // Revenue isn't stored in DB yet
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
