import { describe, expect, it } from 'vitest'
import { YouTubeSyncError, type YouTubeSyncState } from '../app/lib/youtubeSync'
import { selectWatchloadViewState, type WatchloadViewInput } from '../app/lib/watchloadView'

describe('watchload view state', () => {
  it.each([
    ['missing_configuration', 'configuration_missing'],
    ['disconnected', 'disconnected'],
    ['denied', 'disconnected'],
    ['requesting', 'authorizing'],
    ['expired', 'expired'],
    ['revoked', 'revoked']
  ] as const)('maps authorization %s to %s', (authStatus, expected) => {
    expect(selectWatchloadViewState(input({ authStatus }))).toBe(expected)
  })

  it('maps loading, sync, stale, partial and empty data distinctly', () => {
    expect(selectWatchloadViewState(input({ identityLoading: true }))).toBe('loading')
    expect(selectWatchloadViewState(input({ syncState: state({ refreshing: true }) }))).toBe('syncing')
    expect(selectWatchloadViewState(input({ syncState: state({ stale: true, status: 'stale' }) }))).toBe('stale')
    expect(selectWatchloadViewState(input({ syncState: state({ partial: true, status: 'partial' }) }))).toBe('partial')
    expect(selectWatchloadViewState(input({ subscriptionCount: 0 }))).toBe('empty_subscriptions')
    expect(selectWatchloadViewState(input({ eligibleVideoCount: 0 }))).toBe('empty_eligible')
  })

  it('distinguishes recoverable and blocking errors without hiding valid partial data', () => {
    const recoverable = new YouTubeSyncError('Red no disponible.', {
      kind: 'network',
      recoverable: true
    })
    const blocking = new YouTubeSyncError('Cuota agotada.', {
      kind: 'quota_exhausted'
    })

    expect(selectWatchloadViewState(input({ error: recoverable, syncState: null })))
      .toBe('recoverable_error')
    expect(selectWatchloadViewState(input({ error: blocking, syncState: null })))
      .toBe('blocking_error')
    expect(selectWatchloadViewState(input({
      error: blocking,
      syncState: state({ partial: true, status: 'partial', error: blocking })
    }))).toBe('partial')
  })

  it('allows the explicit development fixture without OAuth configuration', () => {
    expect(selectWatchloadViewState(input({
      authStatus: 'missing_configuration',
      mockMode: true
    }))).toBe('ready')
  })
})

function input(overrides: Partial<WatchloadViewInput> = {}): WatchloadViewInput {
  return {
    authStatus: 'connected',
    mockMode: false,
    identityLoading: false,
    error: null,
    syncState: state(),
    subscriptionCount: 1,
    eligibleVideoCount: 1,
    ...overrides
  }
}

function state(overrides: Partial<YouTubeSyncState> = {}): YouTubeSyncState {
  return {
    accountId: 'owner-channel-id',
    status: 'current',
    snapshot: {
      version: 1,
      accountId: 'owner-channel-id',
      subscriptions: [],
      videos: [],
      channelUpdatedAt: {},
      updatedAt: '2026-09-19T12:00:00.000Z',
      lastCompleteSyncAt: '2026-09-19T12:00:00.000Z',
      failedChannelIds: []
    },
    refreshing: false,
    stale: false,
    partial: false,
    error: null,
    ...overrides
  }
}
