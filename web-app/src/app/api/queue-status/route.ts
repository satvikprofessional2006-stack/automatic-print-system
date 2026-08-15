import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get exact count of queued jobs
    const { count, error } = await supabase
      .from('PrintJob')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to fetch queue count');
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error: any) {
    console.error('Queue status error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
