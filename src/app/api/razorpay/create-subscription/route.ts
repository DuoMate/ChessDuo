import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getRazorpay } from '@/lib/razorpay'

export async function POST(request: Request) {
  try {
    let userId: string | undefined

    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (token) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await adminClient.auth.getUser(token)
      if (user) userId = user.id
    }

    if (!userId) {
      const cookieStore = await cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
      )
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) userId = session.user.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { planId } = body

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    const razorpay = getRazorpay()

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12,
      notes: {
        user_id: userId,
      },
    })

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      notes: subscription.notes,
    })
  } catch (e: unknown) {
    const error = e as Error & { statusCode?: number }
    console.error('[Razorpay] Create subscription failed:', error.message || e)
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: error.statusCode || 500 }
    )
  }
}
