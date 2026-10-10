import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, jobId, userName } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // If keys are not yet configured in environment variables, provide demo fallback
    if (!keyId || !keySecret) {
      return NextResponse.json({
        configured: false,
        orderId: `order_demo_${jobId || Date.now()}`,
        amount: Math.round(amount * 100),
        currency: 'INR',
        keyId: null,
        message: 'Razorpay keys not yet configured in .env. Running in demo mode.',
      });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Razorpay amount is always in the smallest currency unit (paise: ₹1 = 100 paise)
    const options = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: (jobId || `job_${Date.now()}`).slice(0, 40),
      notes: {
        jobId: jobId || '',
        userName: userName || '',
        system: 'RU Print Portal',
      },
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      configured: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create payment order' },
      { status: 500 }
    );
  }
}
