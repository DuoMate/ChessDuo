import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { error: rpcError } = await supabase.rpc('delete_my_account')
    if (rpcError) {
      return NextResponse.json({ error: 'Failed to delete: ' + rpcError.message }, { status: 500 })
    }

    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      console.warn('[delete-account] signOut warning:', signOutError.message)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[delete-account] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
