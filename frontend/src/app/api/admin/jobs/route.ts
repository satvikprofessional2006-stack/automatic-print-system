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

    const { data: rawJobs, error } = await supabase
      .from('PrintJob')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(1000);
      
    if (error) {
      console.error("Supabase Error in admin/jobs:", error);
      throw error;
    }
    
    let printerLastSeen = null;
    const jobs = (rawJobs || []).filter(job => {
      if (job.id === '00000000-0000-0000-0000-000000000000') {
        printerLastSeen = job.createdAt;
        return false;
      }
      return true;
    });

    // Optionally enrich jobs with real Razorpay payment IDs & bank UTR numbers
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    let rzpPayments: any[] = [];

    if (keyId && keySecret) {
      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/payments?count=100', {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (rzpRes.ok) {
          const rData = await rzpRes.json();
          rzpPayments = rData?.items || [];
        }
      } catch (err) {
        console.warn('Could not fetch Razorpay payment list:', err);
      }
    }

    const enrichedJobs = jobs.map((job: any) => {
      if (job.utr_no || job.payment_id) return job;

      // Match payment by Razorpay notes.jobId or timestamp proximity + userName
      const rawCreated = String(job.createdAt || '');
      const isoCreated = rawCreated.endsWith('Z') || rawCreated.includes('+') ? rawCreated : `${rawCreated}Z`;
      const jobTime = new Date(isoCreated).getTime();
      const matched = rzpPayments.find((p: any) => {
        if (p.notes?.jobId && p.notes.jobId === job.id) return true;
        const pTime = p.created_at * 1000;
        const diffMinutes = Math.abs(jobTime - pTime) / (60 * 1000);
        // If within 15 minutes and matching userName
        if (diffMinutes <= 15) {
          const pUser = (p.notes?.userName || '').toLowerCase();
          const jUser = (job.userName || '').toLowerCase();
          if (pUser && jUser && (pUser.includes(jUser) || jUser.includes(pUser))) return true;
        }
        return false;
      });

      if (matched) {
        return {
          ...job,
          payment_id: matched.id,
          utr_no:
            matched.acquirer_data?.rrn ||
            matched.acquirer_data?.upi_transaction_id ||
            matched.id,
        };
      }

      return job;
    });
    
    return NextResponse.json({ jobs: enrichedJobs, printerLastSeen });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
