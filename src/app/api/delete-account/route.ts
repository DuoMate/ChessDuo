import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'delete-account'

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const authHeader = request.headers.get('authorization')

    console.log(`[${route}] ${requestId} - Starting, auth header: ${authHeader ? 'present' : 'missing'}`)

    let user = null
    let supabase: any

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      })
      const { data } = await supabase.auth.getUser(token)
      user = data.user
      console.log(`[${route}] ${requestId} - Auth via Bearer token`)
    } else {
      const cookieStore = await cookies()
      const { createServerClient } = await import('@supabase/ssr')
      supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
      })
      const { data } = await supabase.auth.getUser()
      user = data.user
      console.log(`[${route}] ${requestId} - Auth via cookies`)
    }

    if (!user) {
      console.error(`[${route}] ${requestId} - Auth failed, no user`)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log(`[${route}] ${requestId} - User: ${user.id}`)

    if (!supabaseServiceRoleKey) {
      console.error(`[${route}] ${requestId} - SUPABASE_SERVICE_ROLE_KEY is not configured`)
      return NextResponse.json(
        { error: 'Service role key is not configured' },
        { status: 500 },
      )
    }

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
