import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { isAuthorizedAdmin } from '@/lib/adminAuth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!isAuthorizedAdmin(authHeader)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: job, error } = await supabase
      .from('PrintJob')
      .update({ status: 'cancelled', updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;

    // ── AUTOMATIC RAZORPAY REFUND ──
    // Retrieve payment_id from database row or storage metadata
    let paymentId = job?.payment_id || null;
    let metaPayload: any = null;

    try {
      const { data: metaFile } = await supabase.storage.from('print-jobs').download(`${id}.meta.json`);
      if (metaFile) {
        const metaText = await metaFile.text();
        metaPayload = JSON.parse(metaText);
        if (!paymentId && metaPayload?.paymentId) {
          paymentId = metaPayload.paymentId;
        }
      }
    } catch {}

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    let refundData: any = null;

    // If a valid live or test Razorpay payment ID exists, trigger the official Refund API
    if (paymentId && paymentId.startsWith('pay_') && keyId && keySecret) {
      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notes: {
              jobId: id,
              reason: 'Print job cancelled by RU Print Admin'
            }
          })
        });

        if (refundRes.ok) {
          refundData = await refundRes.json();
          console.log(`Razorpay refund successful for job ${id}:`, refundData.id);

          // Update storage metadata with refund audit record
          try {
            const updatedMeta = JSON.stringify({
              ...(metaPayload || {}),
              refundId: refundData.id,
              refundAmount: refundData.amount,
              refundStatus: refundData.status,
              refundedAt: new Date().toISOString()
            });
            await supabase.storage.from('print-jobs').upload(`${id}.meta.json`, Buffer.from(updatedMeta), {
              contentType: 'application/json',
              upsert: true
            });
          } catch {}
        } else {
          const errBody = await refundRes.text();
          console.warn(`Razorpay refund API error for payment ${paymentId}:`, errBody);
        }
      } catch (refErr) {
        console.error('Failed to issue automatic Razorpay refund:', refErr);
      }
    }
    
    // Cleanup: delete the printable document file from storage to free up space
    if (job?.filename) {
      const ext = job.filename.substring(job.filename.lastIndexOf('.')).toLowerCase();
      const storageFilename = `${job.id}${ext}`;
      await supabase.storage.from('print-jobs').remove([storageFilename]);
    }
    
    return NextResponse.json({ 
      success: true, 
      job, 
      refund: refundData 
    });
  } catch (error: any) {
    console.error('Error in job cancel route:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
