# Diagnose room_players 403

## Problem
`328d8fd5` account sometimes registers successfully, sometimes gets 403 on `room_players` upsert. The INSERT policy is set to `WITH CHECK (true)` so 403 should be impossible — indicating either the policy wasn't applied, or there's a session mismatch.

## Diagnostic logs to add

### 1. `src/features/online/game/onlineGame.ts` — in `joinRoom` (~line 289)

Before the upsert, add a session check to compare `auth.uid()` with `playerId`:

```typescript
// Re-register in room_players on reconnect (ensures auth.uid() matches for RLS)
try {
  const { data: { session } } = await supabase.auth.getSession()
  console.log('[ONLINE][DIAG] joinRoom upsert:', {
    playerId,
    team,
    roomId: room.id,
    authUserId: session?.user?.id,
    authUserIdMatches: session?.user?.id === playerId,
    hasSession: !!session,
    sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none',
  })

  const { error } = await supabase.from('room_players').upsert({
```

### 2. `src/components/Game.tsx` — in the joinRoom useEffect (~line 615)

Log when the effect triggers and what values it has:

```typescript
useEffect(() => {
  console.log('[Game][DIAG] joinRoom useEffect firing:', {
    mode,
    isOnline,
    hasOnlineGame: !!onlineGame,
    playerId,
    roomId,
    team,
    conditionsMet: mode === 'online' && !!onlineGame && !!playerId && !!roomId && !!team
  })
  
  if (mode === 'online' && onlineGame && playerId && roomId && team) {
```

### 3. `src/lib/supabase.ts` — log on client creation

Add a one-time log when the supabase client is created, capturing key info:

```typescript
function getSupabaseClient() {
  // ... existing code ...
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)
    console.log('[supabase][DIAG] Client created:', { url: supabaseUrl, anonKeyLength: supabaseAnonKey?.length })
  }
  return supabaseInstance
}
```

## What we'll learn
- `authUserIdMatches: false` → playerId in URL doesn't match the auth session
- `hasSession: false` → no valid auth session when joinRoom runs
- The logs will show if the session expired between page load and joinRoom
