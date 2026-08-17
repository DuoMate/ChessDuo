import { realtimeMetrics } from '../realtimeMetrics'

describe('realtimeMetrics', () => {
  beforeEach(() => realtimeMetrics.reset())

  it('counts channel create/remove and tracks active/peak', () => {
    realtimeMetrics.onChannelCreated('room:r1')
    realtimeMetrics.onChannelCreated('submissions:g1')
    realtimeMetrics.onChannelCreated('badge:u1:1')

    expect(realtimeMetrics.active).toBe(3)
    expect(realtimeMetrics.peak).toBe(3)

    realtimeMetrics.onChannelRemoved('room:r1')
    expect(realtimeMetrics.active).toBe(2)
    expect(realtimeMetrics.peak).toBe(3) // peak is retained

    const report = realtimeMetrics.getReport()
    expect(report.created).toBe(3)
    expect(report.removed).toBe(1)
    expect(report.byType.room).toBe(1)
    expect(report.byType.submissions).toBe(1)
    expect(report.byType.badge).toBe(1)
  })

  it('classifies channel topics by type', () => {
    realtimeMetrics.onChannelCreated('game-status:r1')
    realtimeMetrics.onChannelCreated('global-presence')
    realtimeMetrics.onChannelCreated('messages:u1')
    realtimeMetrics.onChannelCreated('friendships-INSERT-1')
    const report = realtimeMetrics.getReport()
    expect(report.byType['game-status']).toBe(1)
    expect(report.byType.presence).toBe(1)
    expect(report.byType.message).toBe(1)
    expect(report.byType['postgres-changes']).toBe(1)
  })

  it('tracks subscription errors and reconnect counts', () => {
    realtimeMetrics.onChannelCreated('room:r1')
    realtimeMetrics.onSubscribeStatus('room:r1', 'CHANNEL_ERROR')
    realtimeMetrics.onSubscribeStatus('room:r1', 'SUBSCRIBED')
    realtimeMetrics.onReconnectSuccess('room:r1')

    const report = realtimeMetrics.getReport()
    expect(report.channelErrors).toBe(1)
    expect(report.reconnectAttempts).toBe(1)
    expect(report.reconnectSuccess).toBe(1)
    expect(report.subscribed).toBe(1)
    expect(report.recoveryLatencyMs.count).toBeGreaterThanOrEqual(1)
  })

  it('reports p50/p95 recovery latency', () => {
    for (let i = 1; i <= 10; i++) {
      const topic = `room:r${i}`
      realtimeMetrics.onChannelCreated(topic)
      realtimeMetrics.onSubscribeStatus(topic, 'SUBSCRIBED')
    }
    const report = realtimeMetrics.getReport()
    expect(report.recoveryLatencyMs.count).toBe(10)
    expect(report.recoveryLatencyMs.p50).toBeGreaterThanOrEqual(0)
    expect(report.recoveryLatencyMs.p95).toBeGreaterThanOrEqual(0)
  })
})
