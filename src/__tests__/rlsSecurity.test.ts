/**
 * RLS security regression tests (P0-1 launch blocker).
 *
 * These are static assertions against the committed schema (supabase/supabase.sql,
 * the single idempotent source of truth) so CI fails the moment anyone
 * re-introduces a permissive "Allow all" policy or removes a minimum-privilege
 * policy on the game-critical tables.
 *
 * Live security behavior (BLOCK/ALLOW semantics against a real database) is
 * covered by the non-fatal self-check at the end of `supabase/supabase.sql`.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const schemaPath = join(__dirname, '../../supabase/supabase.sql')
const schema = readFileSync(schemaPath, 'utf8')

function stripComments(sql: string): string {
  // Remove -- line comments but keep '...' string literals intact.
  const lines = sql.split('\n')
  const out: string[] = []
  let inString = false
  for (const line of lines) {
    let clean = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === "'") inString = !inString
      if (ch === '-' && line[i + 1] === '-' && !inString) break
      clean += ch
    }
    out.push(clean)
  }
  return out.join('\n')
}

const activeSchema = stripComments(schema)

function policyExists(table: string, name: string): boolean {
  const re = new RegExp(
    `CREATE\\s+POLICY\\s+"${name}"\\s+ON\\s+public\\.${table}`,
    'i'
  )
  return re.test(activeSchema)
}

function policyDropped(table: string, name: string): boolean {
  // A "DROP POLICY" must appear AFTER the last matching "CREATE POLICY" for the
  // same name on the same table, otherwise a stale creation might still apply.
  const createRe = new RegExp(
    `CREATE\\s+POLICY\\s+"${name}"\\s+ON\\s+public\\.${table}`, 'gi'
  )
  const dropRe = new RegExp(
    `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${name}"\\s+ON\\s+public\\.${table}`, 'gi'
  )
  const creates = [...activeSchema.matchAll(createRe)]
  const drops = [...activeSchema.matchAll(dropRe)]
  if (creates.length === 0 && drops.length === 0) return false
  const lastCreate = creates.length > 0 ? creates[creates.length - 1].index : -1
  const lastDrop = drops.length > 0 ? drops[drops.length - 1].index : -1
  // A policy is "removed" when the last statement mentioning it is a DROP.
  return lastDrop > lastCreate && lastCreate === -1
}

describe('P0-1 RLS: no permissive "Allow all" policies remain', () => {
  it('room_players must not have an active "Allow all" policy', () => {
    expect(policyDropped('room_players', 'Allow all')).toBe(true)
  })

  it('games must not have an active "Allow all" policy', () => {
    expect(policyDropped('games', 'Allow all')).toBe(true)
  })

  it('turn_submissions must not have an active "Allow all" policy', () => {
    expect(policyDropped('turn_submissions', 'Allow all')).toBe(true)
  })
})

describe('P0-1 RLS: minimum-privilege policies exist', () => {
  it('room_players: members-only SELECT via is_room_member', () => {
    expect(policyExists('room_players', 'Room members can view players')).toBe(true)
    expect(activeSchema).toMatch(
      /CREATE\s+POLICY\s+"Room members can view players"\s+ON\s+public\.room_players[\s\S]*?is_room_member\(room_id\)/i
    )
  })

  it('room_players: INSERT restricted to the player themselves + capacity', () => {
    expect(policyExists('room_players', 'Players can join rooms')).toBe(true)
    expect(activeSchema).toMatch(
      /CREATE\s+POLICY\s+"Players can join rooms"\s+ON\s+public\.room_players[\s\S]*?auth\.uid\(\)::text\s*=\s*player_id[\s\S]*?can_join_room\(room_id,\s*player_id\)/i
    )
  })

  it('room_players: UPDATE/DELETE restricted to the player or room creator', () => {
    expect(policyExists('room_players', 'Players can update own record')).toBe(true)
    expect(policyExists('room_players', 'Players can leave rooms')).toBe(true)
    expect(policyExists('room_players', 'Room creator can update room players')).toBe(true)
    expect(policyExists('room_players', 'Room creator can delete room players')).toBe(true)
  })

  it('games: SELECT/INSERT/UPDATE restricted to room members', () => {
    expect(policyExists('games', 'Room members can view game')).toBe(true)
    expect(policyExists('games', 'Room members can insert game')).toBe(true)
    expect(policyExists('games', 'Room members can update game')).toBe(true)
  })

  it('turn_submissions: SELECT for members, INSERT only own move', () => {
    expect(policyExists('turn_submissions', 'Room members can view turn submissions')).toBe(true)
    expect(policyExists('turn_submissions', 'Players can submit their own moves')).toBe(true)
    expect(activeSchema).toMatch(
      /CREATE\s+POLICY\s+"Players can submit their own moves"\s+ON\s+public\.turn_submissions[\s\S]*?auth\.uid\(\)::text\s*=\s*player_id/i
    )
  })

  it('turn_submissions: no UPDATE/DELETE policy granted to clients', () => {
    // The only policies named for turn_submissions must be the two read/write ones;
    // clients must never be able to alter or delete submissions directly.
    const clientPolicies = activeSchema
      .split('\n')
      .filter((line) => /CREATE\s+POLICY/.test(line) && /turn_submissions/.test(line))
    expect(clientPolicies.length).toBe(2)
  })

  it('rooms: member resignation (UPDATE status) and creator DELETE are preserved', () => {
    expect(policyExists('rooms', 'Room members can update room status')).toBe(true)
    expect(policyExists('rooms', 'Room creator can delete room')).toBe(true)
  })

  it('capacity helper can_join_room is defined as SECURITY DEFINER', () => {
    expect(activeSchema).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.can_join_room/i)
    expect(activeSchema).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.can_join_room[\s\S]*?SECURITY\s+DEFINER/i
    )
  })
})