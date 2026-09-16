import { sameRoster } from '../FourPlayerLobby'
import type { LobbyPlayer } from '@/lib/fourPlayerActions'

const seat = (overrides: Partial<LobbyPlayer> = {}): LobbyPlayer => ({
  playerId: 'p1',
  username: 'Alice',
  team: 'WHITE',
  slot: 0,
  status: 'joined',
  ...overrides,
})

describe('sameRoster (P4 lobby-poll regression lock)', () => {
  test('identical rosters are equal (poll must bail out, no re-render)', () => {
    const a = [seat(), seat({ playerId: 'p2', username: 'Bob', team: 'BLACK', slot: 0 })]
    const b = [seat(), seat({ playerId: 'p2', username: 'Bob', team: 'BLACK', slot: 0 })]
    expect(sameRoster(a, b)).toBe(true)
  })

  test('empty rosters are equal', () => {
    expect(sameRoster([], [])).toBe(true)
  })

  test('join / leave changes the roster', () => {
    expect(sameRoster([seat()], [])).toBe(false)
    expect(sameRoster([], [seat()])).toBe(false)
  })

  test('team or slot change propagates', () => {
    expect(sameRoster([seat()], [seat({ team: 'BLACK' })])).toBe(false)
    expect(sameRoster([seat()], [seat({ slot: 1 })])).toBe(false)
  })

  test('ready / lock status change propagates', () => {
    expect(sameRoster([seat()], [seat({ status: 'ready' })])).toBe(false)
    expect(sameRoster([seat({ status: 'ready' })], [seat({ status: 'locked' })])).toBe(false)
  })

  test('username change propagates', () => {
    expect(sameRoster([seat()], [seat({ username: 'Alicia' })])).toBe(false)
  })
})
