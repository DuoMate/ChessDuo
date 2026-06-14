# Fix room_players 403 — bypass RLS via service role API route

## Root cause
The SQL file is 560+ lines. When run in Supabase editor, an earlier statement silently fails (likely ALTER TABLE ADD CONSTRAINT on an already-existing PK), halting execution. The CREATE POLICY at line 332 never executes. The `public.` prefix fix didn't help because the policy isn't being created at all.

## Fix: API route + client-side call

1. **Create `src/app/api/room/register/route.ts`** — Server-side endpoint that uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS entirely, matching the pattern from `src/app/api/razorpay/webhook/route.ts`.

2. **Update `src/features/online/game/onlineGame.ts`** — Replace the direct `supabase.from('room_players').upsert(...)` with a `fetch()` call to `/api/room/register`.

3. **Also fix `select`/RPC queries** in `startGameWhenReady` and polling — these also fail with 403 (see `games` table 403). Same approach or use the RPC function (which is SECURITY DEFINER).

## File to create
`src/app/api/room/register/route.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const serviceRoleClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  const { roomId, playerId, team } = await request.json()
  
  const { error } = await serviceRoleClient
    .from('room_players')
    .upsert({
      room_id: roomId,
      player_id: playerId,
      team,
      slot: 0,
      status: 'ready'
    }, { onConflict: 'room_id,player_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
```

## File to modify
`src/features/online/game/onlineGame.ts` — `joinRoom` method:
- Replace the `supabase.from('room_players').upsert(...)` block with a `fetch('/api/room/register', ...)` call
- Keep the existing log messages
- Remove the supabase direct client call for this operation

## Affected: Also fix SELECT queries
`startGameWhenReady` queries `room_players` via `supabase.from('room_players').select(...)` and `supabase.rpc('get_room_players', ...)`. The RPC is SECURITY DEFINER (should be OK). The direct `select` also fails — this needs the same bypass.

Create `src/app/api/room/players/route.ts` for the SELECT query.
