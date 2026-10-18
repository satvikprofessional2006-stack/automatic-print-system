import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { computeTaskDisplayId } from '@/lib/orderNumber';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userName = searchParams.get('userName') || searchParams.get('name') || '';
    const email = searchParams.get('email') || '';

    if (!userName.trim() && !email.trim()) {
      return NextResponse.json({ tasks: [] });
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('PrintJob')
      .select('*')
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .order('createdAt', { ascending: false })
      .limit(40);

    // Filter by student's name
    if (userName.trim()) {
      query = query.ilike('userName', `%${userName.trim()}%`);
    } else if (email.trim()) {
      // Fallback: extract name prefix from email (e.g. satvik.25110 -> satvik)
      const cleanPrefix = email.split('@')[0].split('.')[0].replace(/[0-9]/g, '').trim();
      if (cleanPrefix) {
        query = query.ilike('userName', `%${cleanPrefix}%`);
      }
    }

    const { data: rawJobs, error } = await query;

    if (error || !rawJobs || rawJobs.length === 0) {
      if (error) console.error("Error querying PrintJob for student:", error);
      return NextResponse.json({ tasks: [] });
    }

    // Group jobs that belong to the same print order (within 60 seconds of each other)
    const groups: any[][] = [];
    for (const job of rawJobs) {
      const existingIdx = groups.findIndex((grp) => {
        const first = grp[0];
        const last = grp[grp.length - 1];
        const diff1 = Math.abs(new Date(first.createdAt).getTime() - new Date(job.createdAt).getTime());
        const diff2 = Math.abs(new Date(last.createdAt).getTime() - new Date(job.createdAt).getTime());
        return diff1 <= 60000 || diff2 <= 60000;
      });

      if (existingIdx !== -1) {
        groups[existingIdx].push(job);
      } else {
        groups.push([job]);
      }
    }

    // For each group, compute taskDisplayId and aggregate details
    const tasks = await Promise.all(
      groups.map(async (grp) => {
        const first = grp[0];
        const taskDisplayId = await computeTaskDisplayId(supabase, first.id);

        let overallStatus = 'completed';
        if (grp.some((j) => j.status === 'failed')) overallStatus = 'failed';
        else if (grp.some((j) => j.status === 'cancelled')) overallStatus = 'cancelled';
        else if (grp.some((j) => j.status === 'printing')) overallStatus = 'printing';
        else if (grp.some((j) => j.status === 'queued')) overallStatus = 'queued';
        else if (grp.some((j) => j.status === 'paid')) overallStatus = 'paid';

        const calculatedAmount = grp.reduce((sum, j) => {
          const copies = j.copies || 1;
          const isA3 = (j.paper_size || j.paperSize) === 'A3';
          const rate = isA3 ? (j.color ? 20 : 5) : (j.color ? 10 : 2);
          return sum + copies * rate;
        }, 0);

        const totalPages = grp.reduce((sum, j) => sum + (j.copies || 1), 0);

        return {
          id: first.id,
          taskDisplayId,
          createdAt: first.createdAt,
          status: overallStatus,
          amount: calculatedAmount,
          totalPages,
          files: grp.map((j) => ({
            id: j.id,
            filename: j.filename || 'Document.pdf',
            copies: j.copies || 1,
            color: j.color || false,
            paperSize: j.paper_size || j.paperSize || 'A4',
            status: j.status,
          })),
        };
      })
    );

    return NextResponse.json({ tasks });
  } catch (err: any) {
    console.error('Error in /api/student/my-jobs:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
