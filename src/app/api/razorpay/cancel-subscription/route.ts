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

    const { data: profile } = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
      .from('profiles')
      .select('rzp_subscription_id, subscription_status')
      .eq('id', userId)
      .maybeSingle()

    if (!profile?.rzp_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const razorpay = getRazorpay()

    await razorpay.subscriptions.cancel(profile.rzp_subscription_id, true)

    await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
      .from('profiles')
      .update({ subscription_status: 'canceling' })
      .eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const error = e as Error & { statusCode?: number }
    console.error('[Razorpay] Cancel subscription failed:', error.message || e)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: error.statusCode || 500 }
    )
  }
}
