import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const results: Record<string, unknown> = {}
  
  // Test 1: Check env vars
  results.envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'
  results.envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET (hidden)' : 'NOT SET'
  
  // Test 2: Create client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  
  if (!supabaseUrl || !supabaseKey) {
    results.status = 'MISSING_ENV_VARS'
    return NextResponse.json(results)
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  // Test 3: Try to query rooms table
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, code, status')
      .limit(1)
    
    if (error) {
      results.tableCheck = 'FAILED'
      results.tableError = error.message
      results.tableHint = error.hint || null
      results.details = error.details || null
    } else {
      results.tableCheck = 'SUCCESS'
      results.tableData = data
    }
  } catch (err) {
    results.tableCheck = 'EXCEPTION'
    results.error = err instanceof Error ? err.message : String(err)
  }
  
  return NextResponse.json(results)
}