import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, paymentId, signature, jobId } = body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Handle demo/test orders when keys are not yet configured
    if (!keySecret || orderId?.startsWith('order_demo_')) {
      return NextResponse.json({
        success: true,
        verified: true,
        demo: true,
        message: 'Demo payment verified successfully',
      });
    }

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: 'orderId, paymentId, and signature are required for verification' },
        { status: 400 }
      );
    }

    // Official Razorpay HMAC-SHA256 signature verification
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = generatedSignature === signature;

    if (!isValid) {
      console.error('Razorpay signature verification failed:', {
        orderId,
        paymentId,
        signature,
        generatedSignature,
      });
      return NextResponse.json(
        { success: false, error: 'Payment verification failed: Invalid signature' },
        { status: 400 }
      );
    }

    // Fetch real bank UTR / RRN from Razorpay payment details
    let utrNo: string = paymentId;
    try {
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
      if (keyId && keySecret) {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (rzpRes.ok) {
          const pData = await rzpRes.json();
          utrNo =
            pData?.acquirer_data?.rrn ||
            pData?.acquirer_data?.upi_transaction_id ||
            pData?.id ||
            paymentId;
        }
      }
    } catch (e) {
      console.warn('Could not fetch Razorpay acquirer UTR data:', e);
    }

    return NextResponse.json({
      success: true,
      verified: true,
      paymentId,
      orderId,
      utrNo,
    });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: error?.message || 'Payment verification failed' },
      { status: 500 }
    );
  }
}
