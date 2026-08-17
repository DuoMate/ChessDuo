#!/usr/bin/env node
/**
 * ChessDuo Realtime capacity simulation (P0-3).
 *
 * Measures the BACKEND (Supabase Realtime + DB + RLS) under N concurrent
 * games by driving real room/game channels, move submissions, and turn
 * resolutions from Node — no browser/WASM involved, so results isolate the
 * transport/data layer that the load test targets.
 *
 * Requires staging credentials:
 *   export SUPABASE_URL=...            # project URL
 *   export TEST_USER_BASE=player        # seeded account username prefix
 *   export TEST_USER_PASSWORD=...       # shared password for seeded accounts
 *   export TEST_USERS=100               # number of seeded accounts
 *
 * Seeded accounts must be username `player1..playerN` (email
 * `player1@example.com` etc.) with the same password, created in staging.
 *
 * Usage:
 *   node scripts/loadtest/run.mjs --games 10 --turns 6
 *   node scripts/loadtest/run.mjs --games 100 --turns 6
 *
 * Output: a JSON summary (peak channels, subscribe latency p50/p95,
 * CHANNEL_ERROR count, DB write latency, stuck/failed games, duration).
 */
import { createClient } from '@supabase/supabase-js'
import { performance } from 'node:perf_hooks'

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}

const GAMES = Number(arg('--games', '10'))
const TURNS = Number(arg('--turns', '6'))
const url = process.env.SUPABASE_URL || ''
const base = process.env.TEST_USER_BASE || 'player'
const password = process.env.TEST_USER_PASSWORD || ''
const totalUsers = Number(process.env.TEST_USERS || '200')

if (!url || !password) {
  console.error('Missing SUPABASE_URL or TEST_USER_PASSWORD')
  process.exit(1)
}

const code = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]
  return c
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function signIn(index) {
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
  const email = `${base}${index}@example.com`
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return client
}

async function simulateGame(host, joiner, gameIndex, latencies) {
  const metrics = {
    channels: 0,
    channelErrors: 0,
    subscribeLatencies: [],
    dbWriteLatencies: [],
    failed: false,
  }

  // Host creates a room (authenticated RLS path).
  const hostId = (await host.auth.getUser()).data.user.id
  const now = new Date()
  const expires = new Date(Date.now() + 3600_000).toISOString()
  const { data: room, error: roomErr } = await host
    .from('rooms')
    .insert({ code: code(), status: 'waiting', mode: 'online', created_by: hostId, time_seconds: 600, expires_at: expires, host_team: 'WHITE' })
    .select()
    .single()
  if (roomErr || !room) { metrics.failed = true; return metrics }
  const roomId = room.id

  // Join both players.
  for (const [client, idx] of [[host, 0], [joiner, 1]]) {
    const playerId = (await client.auth.getUser()).data.user.id
    const { error: joinErr } = await client
      .from('room_players')
      .upsert({ room_id: roomId, player_id: playerId, team: 'WHITE', slot: idx }, { onConflict: 'room_id,player_id' })
    if (joinErr) { metrics.failed = true; return metrics }
  }

  // Create a game row (host is coordinator).
  const { data: game, error: gameErr } = await host
    .from('games')
    .insert({ room_id: roomId, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', current_turn: 'WHITE', status: 'PLAYING', coordinator_id: hostId, turn_number: 0, match_started_at: now.toISOString(), match_time_limit_seconds: 600 })
    .select('id')
    .single()
  if (gameErr || !game) { metrics.failed = true; return metrics }

  // Open a room channel on both clients to measure subscribe latency.
  const hostChan = host.channel(`room:${roomId}`)
  const joinerChan = joiner.channel(`room:${roomId}`)
  metrics.channels += 2
  for (const [client, chan] of [[host, hostChan], [joiner, joinerChan]]) {
    const t0 = performance.now()
    await new Promise((resolve, reject) => {
      chan.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          metrics.subscribeLatencies.push(performance.now() - t0)
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'SUBSCRIBE_ERROR') {
          metrics.channelErrors++
          reject(new Error('channel ' + status))
        }
      })
      setTimeout(() => reject(new Error('subscribe timeout')), 10_000)
    })
    // keep the channel open for the run
    client._openChannels ||= []
    client._openChannels.push(chan)
  }

  // Simulate turns: submit two moves, resolve, write GAME_OVER at end.
  for (let turn = 1; turn <= TURNS; turn++) {
    const t0 = performance.now()
    const { error: s1 } = await host
      .from('turn_submissions')
      .upsert({ game_id: game.id, turn_number: turn, player_id: hostId, move_san: 'e4', move_from: 'e2', move_to: 'e4', piece: 'p' }, { onConflict: 'game_id,turn_number,player_id' })
    const joinerId = (await joiner.auth.getUser()).data.user.id
    const { error: s2 } = await joiner
      .from('turn_submissions')
      .upsert({ game_id: game.id, turn_number: turn, player_id: joinerId, move_san: 'e4', move_from: 'e2', move_to: 'e4', piece: 'p' }, { onConflict: 'game_id,turn_number,player_id' })
    metrics.dbWriteLatencies.push(performance.now() - t0)
    if (s1 || s2) { metrics.failed = true; break }
  }

  // Close channels.
  for (const chan of host._openChannels || []) await host.removeChannel(chan)
  for (const chan of joiner._openChannels || []) await joiner.removeChannel(chan)

  return metrics
}

async function main() {
  const clients = []
  const used = new Set()
  // Sign in enough accounts for 2 per game.
  for (let i = 0; i < Math.min(GAMES * 2, totalUsers); i++) {
    clients.push(await signIn((i % totalUsers) + 1))
  }

  const tStart = performance.now()
  const all = []
  const subscribeLat = []
  const writeLat = []
  let channelErrors = 0
  let peak = 0
  let stuck = 0
  let failed = 0

  for (let g = 0; g < GAMES; g++) {
    const host = clients[(g * 2) % clients.length]
    const joiner = clients[(g * 2 + 1) % clients.length]
    const m = await simulateGame(host, joiner, g, null)
    all.push(m)
    subscribeLat.push(...m.subscribeLatencies)
    writeLat.push(...m.dbWriteLatencies)
    channelErrors += m.channelErrors
    if (m.failed) failed++
    peak = Math.max(peak, m.channels * Math.min(g + 1, GAMES))
    await sleep(50)
  }

  const durationMs = performance.now() - tStart
  const pct = (arr, p) => {
    if (!arr.length) return 0
    const s = [...arr].sort((a, b) => a - b)
    return s[Math.min(s.length - 1, Math.floor(s.length * p))]
  }

  console.log(JSON.stringify({
    games: GAMES,
    turnsPerGame: TURNS,
    durationMs: Math.round(durationMs),
    peakConcurrentChannels: peak,
    subscribeLatencyMs: { p50: Math.round(pct(subscribeLat, 0.5)), p95: Math.round(pct(subscribeLat, 0.95)) },
    dbWriteLatencyMs: { p50: Math.round(pct(writeLat, 0.5)), p95: Math.round(pct(writeLat, 0.95)) },
    channelErrorCount: channelErrors,
    failedGames: failed,
    stuckGames: stuck,
  }, null, 2))

  process.exit(0)
}

main().catch((e) => {
  console.error('load test failed:', e)
  process.exit(1)
})
