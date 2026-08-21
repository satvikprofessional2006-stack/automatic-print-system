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

    // Fetch all jobs to do dynamic grouping in memory so stats match the batched table exactly
    const { data: allJobs, error } = await supabase
      .from('PrintJob')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }

    const jobs = allJobs || [];
    const processedJobs: any[][] = [];

    // Grouping logic (same as frontend)
    for (const job of jobs) {
      const existingGroupIndex = processedJobs.findIndex(group => {
        const firstInGroup = group[0];
        const lastInGroup = group[group.length - 1];
        if (firstInGroup.userName !== job.userName) return false;
        
        const timeDiffFirst = Math.abs(new Date(firstInGroup.createdAt).getTime() - new Date(job.createdAt).getTime());
        const timeDiffLast = Math.abs(new Date(lastInGroup.createdAt).getTime() - new Date(job.createdAt).getTime());
        
        return timeDiffFirst <= 60000 || timeDiffLast <= 60000;
      });

      if (existingGroupIndex !== -1) {
        processedJobs[existingGroupIndex].push(job);
      } else {
        processedJobs.push([job]);
      }
    }

    const normalized = processedJobs.map(group => {
      const totalCopies = group.reduce((sum: number, j: any) => sum + (j.copies || 1), 0);
      let overallStatus = 'completed';
      if (group.some((j: any) => j.status === 'failed')) overallStatus = 'failed';
      else if (group.some((j: any) => j.status === 'printing')) overallStatus = 'printing';
      else if (group.some((j: any) => j.status === 'queued')) overallStatus = 'queued';
      else if (group.every((j: any) => j.status === 'cancelled')) overallStatus = 'cancelled';

      return {
        copies: totalCopies,
        status: overallStatus,
      };
    });

    const totalCount = normalized.length;
    const doneCount = normalized.filter(j => j.status === 'completed').length;
    const queuedCount = normalized.filter(j => ['queued', 'printing'].includes(j.status)).length;
    const failedCount = normalized.filter(j => j.status === 'failed').length;
    const cancelledCount = normalized.filter(j => j.status === 'cancelled').length;
    
    // Revenue is currently 0 in the system because 'amount' is not stored in Supabase.
    // Setting it to 0 so it perfectly matches the ₹0 Amount column in the Print Logs table.
    const revenue = 0;

    return NextResponse.json({
      total: totalCount,
      done: doneCount,
      inQueue: queuedCount,
      failed: failedCount,
      cancelled: cancelledCount,
      revenue: revenue
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
