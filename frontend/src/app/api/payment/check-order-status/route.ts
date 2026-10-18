import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'orderId parameter is required' }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Handle demo orders when keys are not configured
    if (!keyId || !keySecret || orderId.startsWith('order_demo_')) {
      return NextResponse.json({
        paid: false,
        status: 'demo_unpaid',
        message: 'Demo mode or missing keys',
      });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Fetch payments for this specific Razorpay order
    const payments = await razorpay.orders.fetchPayments(orderId);

    if (!payments || !payments.items || payments.items.length === 0) {
      return NextResponse.json({
        paid: false,
        status: 'no_payments_found',
      });
    }

    // Look for any captured or authorized payment
    const successfulPayment = payments.items.find(
      (p: any) => p.status === 'captured' || p.status === 'authorized'
    );

    if (successfulPayment) {
      const utrNo =
        (successfulPayment as any)?.acquirer_data?.rrn ||
        (successfulPayment as any)?.acquirer_data?.upi_transaction_id ||
        successfulPayment.id;

      return NextResponse.json({
        paid: true,
        status: successfulPayment.status,
        paymentId: successfulPayment.id,
        orderId: orderId,
        amount: successfulPayment.amount,
        utrNo: utrNo,
      });
    }

    return NextResponse.json({
      paid: false,
      status: payments.items[0]?.status || 'pending',
    });
  } catch (error: any) {
    console.error('Error checking order status with Razorpay:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to check order status' },
      { status: 500 }
    );
  }
}
