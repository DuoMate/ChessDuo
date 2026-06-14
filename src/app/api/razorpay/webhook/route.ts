import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function POST(request: Request) {
  const signature = request.headers.get('x-razorpay-signature')
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || ''

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  const body = await request.text()

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex')

  if (signature !== expectedSignature) {
    console.error('[Razorpay Webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: { event: string; payload: { subscription?: { entity?: { id?: string; status?: string; notes?: Record<string, string>; customer_id?: string } } } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        const sub = event.payload?.subscription?.entity
        const userId = sub?.notes?.user_id
        if (!userId || !sub?.id) break

        await supabase
          .from('profiles')
          .update({
            is_premium: true,
            rzp_subscription_id: sub.id,
            rzp_customer_id: sub.customer_id || null,
            subscription_status: 'active',
          })
          .eq('id', userId)
        break
      }

      case 'subscription.completed': {
        const sub = event.payload?.subscription?.entity
        if (!sub?.id) break

        await supabase
          .from('profiles')
          .update({
            is_premium: false,
            subscription_status: 'inactive',
          })
          .eq('rzp_subscription_id', sub.id)
        break
      }

      case 'subscription.updated': {
        const sub = event.payload?.subscription?.entity
        if (!sub?.id || !sub?.status) break

        const status: 'active' | 'inactive' =
          sub.status === 'active' ? 'active' : 'inactive'

        await supabase
          .from('profiles')
          .update({
            subscription_status: status,
            is_premium: sub.status === 'active',
          })
          .eq('rzp_subscription_id', sub.id)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (e: unknown) {
    const error = e as Error
    console.error('[Razorpay Webhook] DB update failed:', error.message || e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
