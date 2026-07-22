import { cookies } from 'next/headers'

interface AuthClientResult {
  user: { id: string; email?: string } | null
  supabase: any
  error: string | null
}

export async function getAuthClient(
  request: Request,
  route: string,
  requestId: string,
): Promise<AuthClientResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const authHeader = request.headers.get('authorization')

  console.log(`[${route}] ${requestId} - Starting, auth header: ${authHeader ? 'present' : 'missing'}`)

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data } = await supabase.auth.getUser(token)
    console.log(`[${route}] ${requestId} - Auth via Bearer token`)
    return { user: data.user || null, supabase, error: null }
  }

  const cookieStore = await cookies()
  const { createServerClient } = await import('@supabase/ssr')
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })
  const { data } = await supabase.auth.getUser()
  console.log(`[${route}] ${requestId} - Auth via cookies`)
  return { user: data.user || null, supabase, error: null }
}
