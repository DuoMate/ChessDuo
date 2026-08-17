import { createClient } from '@supabase/supabase-js'

/**
 * Server-side sink for application error records (P0-2).
 *
 * Uses the public anon key with NO caller token on purpose: error capture must
 * work for anonymous and pre-login crashes, and the app_errors table only ever
 * accepts appends (no SELECT/UPDATE/DELETE for the anon/authenticated roles).
 * Rate limiting and origin checks live in the /api/log-crash route.
 */

let client: ReturnType<typeof createClient> | null = null

function getClient(): ReturnType<typeof createClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !anonKey) return null
  if (!client) {
    client = createClient(url, anonKey)
  }
  return client
}

type ErrorInsertClient = {
  from: (table: string) => {
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message?: string } | null }>
  }
}

export async function recordAppError(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const supabase = getClient()
    if (!supabase) return false
    const { error } = await (supabase as unknown as ErrorInsertClient)
      .from('app_errors')
      .insert([payload])
    return !error
  } catch {
    return false
  }
}
