import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

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

    const userId = user.id
    const admin = getSupabaseAdmin()

    await Promise.all([
      admin.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      admin.from('friendships').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      admin.from('challenge_links').delete().eq('creator_id', userId),
      admin.from('duel_games').delete().or(`player_white.eq.${userId},player_black.eq.${userId}`),
      admin.from('profiles').delete().eq('id', userId),
    ])

    const roomPlayers = await admin.from('room_players').select('room_id').eq('player_id', userId)
    if (roomPlayers.data && roomPlayers.data.length > 0) {
      const roomIds = roomPlayers.data.map(rp => rp.room_id)
      await admin.from('games').delete().in('room_id', roomIds)
      await admin.from('room_players').delete().eq('player_id', userId)
      await admin.from('rooms').delete().in('id', roomIds)
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete user: ' + deleteError.message }, { status: 500 })
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
