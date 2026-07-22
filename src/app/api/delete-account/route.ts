import { NextResponse } from 'next/server'
import { getAuthClient } from '@/lib/apiAuth'

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'delete-account'

  try {
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    const { user: authUser, supabase: authSupabase, error: authError } = await getAuthClient(request, route, requestId)
    if (!authUser) {
      console.error(`[${route}] ${requestId} - Auth failed, no user`)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const user = authUser
    const supabase = authSupabase

    if (!supabaseServiceRoleKey) {
      console.error(`[${route}] ${requestId} - SUPABASE_SERVICE_ROLE_KEY is not configured`)
      return NextResponse.json(
        { error: 'Service role key is not configured' },
        { status: 500 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    let adminSupabase: any
    const { createClient } = await import('@supabase/supabase-js')
    adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { error: rpcError } = await supabase.rpc('delete_my_account')
    if (rpcError) {
      console.error(`[${route}] ${requestId} - RPC error: ${rpcError.message}`)
      return NextResponse.json({ error: 'Failed to delete: ' + rpcError.message }, { status: 500 })
    }

    console.log(`[${route}] ${requestId} - Public data deleted via RPC`)

    const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(user.id)
    if (deleteUserError) {
      console.error(`[${route}] ${requestId} - Admin deleteUser error: ${deleteUserError.message}`)
      return NextResponse.json(
        { error: 'Failed to delete auth user: ' + deleteUserError.message },
        { status: 500 },
      )
    }

    console.log(`[${route}] ${requestId} - Auth user deleted via Admin API`)

    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      console.warn(`[${route}] ${requestId} - SignOut warning: ${signOutError.message}`)
    }

    console.log(`[${route}] ${requestId} - Success`)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`[${route}] ${requestId} - Exception: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
