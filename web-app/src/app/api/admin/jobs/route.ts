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

    const { data: jobs, error } = await supabase
      .from('PrintJob')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(50);
      
    if (error) throw error;
    
    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
