import { describe, expect, it, vi } from 'vitest'
import { YouTubeApiError } from '../app/lib/youtubeApi'
import {
  YOUTUBE_CACHE_RETENTION_MS,
  YOUTUBE_CACHE_TTL_MS,
  type YouTubeCacheSnapshot,
  type YouTubeCacheStore
} from '../app/lib/youtubeCache'
import {
  createYouTubeSyncManager,
  normalizeYouTubeSyncError,
  YouTubeSyncError,
  type YouTubeSnapshotLoader
} from '../app/lib/youtubeSync'
import type { PublishedVideo, SubscribedChannel } from '../app/lib/youtubeTypes'

const NOW = new Date('2026-09-19T12:00:00.000Z')
const ACCOUNT_A = 'account-a'

describe('YouTube cache and sync manager', () => {
  it('uses a fresh account snapshot without API calls', async () => {
    const store = new MemoryYouTubeCacheStore([
      snapshot({ updatedAt: isoBefore(YOUTUBE_CACHE_TTL_MS - 1) })
    ])
    const load = vi.fn<YouTubeSnapshotLoader>()
    const manager = createManager(store, load)

    const state = await manager.open(ACCOUNT_A)

    expect(state).toMatchObject({ status: 'current', refreshing: false, stale: false })
    expect(state.snapshot?.videos.map(({ id }) => id)).toEqual(['old-alpha'])
    expect(load).not.toHaveBeenCalled()
  })

  it('returns stale data immediately and synchronizes it in the background', async () => {
    const store = new MemoryYouTubeCacheStore([
      snapshot({ updatedAt: isoBefore(YOUTUBE_CACHE_TTL_MS) })
    ])
    const pending = deferred<ReturnType<YouTubeSnapshotLoader> extends Promise<infer T> ? T : never>()
    const load = vi.fn<YouTubeSnapshotLoader>(() => pending.promise)
    const manager = createManager(store, load)

    const staleState = await manager.open(ACCOUNT_A)

    expect(staleState).toMatchObject({ status: 'stale', stale: true, refreshing: true })
    expect(staleState.snapshot?.videos[0].id).toBe('old-alpha')
    expect(load).toHaveBeenCalledOnce()

    pending.resolve(completeLoad([video('new-alpha', 'alpha')]))
    await vi.waitFor(() => expect(manager.getState(ACCOUNT_A).refreshing).toBe(false))

    expect(manager.getState(ACCOUNT_A)).toMatchObject({ status: 'current', stale: false })
    expect(manager.getState(ACCOUNT_A).snapshot?.videos[0].id).toBe('new-alpha')
  })

  it('manual refresh ignores TTL and simultaneous manual calls share one promise', async () => {
    const store = new MemoryYouTubeCacheStore([snapshot()])
    const pending = deferred<ReturnType<YouTubeSnapshotLoader> extends Promise<infer T> ? T : never>()
    const load = vi.fn<YouTubeSnapshotLoader>(() => pending.promise)
    const manager = createManager(store, load)

    await manager.open(ACCOUNT_A)
    const first = manager.refresh(ACCOUNT_A)
    const second = manager.refresh(ACCOUNT_A)

    expect(first).toBe(second)
    expect(load).toHaveBeenCalledOnce()

    pending.resolve(completeLoad([video('manual-alpha', 'alpha')]))
    await expect(first).resolves.toMatchObject({ status: 'current' })
    expect(manager.getState(ACCOUNT_A).snapshot?.videos[0].id).toBe('manual-alpha')
  })

  it('manual refresh cancels an active automatic refresh and starts a new one', async () => {
    const store = new MemoryYouTubeCacheStore([
      snapshot({ updatedAt: isoBefore(YOUTUBE_CACHE_TTL_MS) })
    ])
    let automaticSignal: AbortSignal | undefined
    const manual = deferred<ReturnType<YouTubeSnapshotLoader> extends Promise<infer T> ? T : never>()
    const load = vi.fn<YouTubeSnapshotLoader>((context) => {
      if (!automaticSignal) {
        automaticSignal = context.signal
        return new Promise((_, reject) => {
          context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true })
        })
      }

      return manual.promise
    })
    const manager = createManager(store, load)

    await manager.open(ACCOUNT_A)
    const manualRefresh = manager.refresh(ACCOUNT_A)

    expect(automaticSignal?.aborted).toBe(true)
    expect(load).toHaveBeenCalledTimes(2)

    manual.resolve(completeLoad([video('manual-alpha', 'alpha')]))
    await expect(manualRefresh).resolves.toMatchObject({ status: 'current' })
    expect(manager.getState(ACCOUNT_A).snapshot?.videos[0].id).toBe('manual-alpha')
  })

  it('merges valid channels with stale data for failed channels', async () => {
    const oldBetaUpdatedAt = isoBefore(2 * 60 * 60 * 1000)
    const previous = snapshot({
      subscriptions: [channel('alpha'), channel('beta')],
      videos: [video('old-alpha', 'alpha'), video('old-beta', 'beta')],
      channelUpdatedAt: { alpha: oldBetaUpdatedAt, beta: oldBetaUpdatedAt },
      updatedAt: oldBetaUpdatedAt,
      lastCompleteSyncAt: oldBetaUpdatedAt
    })
    const store = new MemoryYouTubeCacheStore([previous])
    const load = vi.fn<YouTubeSnapshotLoader>(async () => ({
      subscriptions: [channel('alpha'), channel('beta')],
      channels: [
        { channelId: 'alpha', videos: [video('new-alpha', 'alpha')] },
        {
          channelId: 'beta',
          error: new YouTubeSyncError('Canal beta no disponible.', { kind: 'invalid_response' })
        }
      ]
    }))
    const manager = createManager(store, load, { retryDelaysMs: [] })

    const state = await manager.refresh(ACCOUNT_A)

    expect(state).toMatchObject({ status: 'partial', partial: true, stale: false })
    expect(state.error).toMatchObject({
      kind: 'partial_channel',
      channelErrors: [{ channelId: 'beta', kind: 'invalid_response' }]
    })
    expect(state.snapshot?.videos.map(({ id }) => id).sort()).toEqual(['new-alpha', 'old-beta'])
    expect(state.snapshot?.channelUpdatedAt).toEqual({
      alpha: NOW.toISOString(),
      beta: oldBetaUpdatedAt
    })
    expect(state.snapshot?.updatedAt).toBe(NOW.toISOString())
    expect(state.snapshot?.lastCompleteSyncAt).toBe(oldBetaUpdatedAt)
  })

  it('retries only recoverable failed channels with injected backoff', async () => {
    const store = new MemoryYouTubeCacheStore()
    const sleep = vi.fn(async () => {})
    const load = vi.fn<YouTubeSnapshotLoader>(async ({ channelIds }) => {
      if (!channelIds) {
        return {
          subscriptions: [channel('alpha'), channel('beta')],
          channels: [
            { channelId: 'alpha', videos: [video('alpha-video', 'alpha')] },
            {
              channelId: 'beta',
              error: new YouTubeSyncError('Red caída.', { kind: 'network' })
            }
          ]
        }
      }

      return {
        channels: [{ channelId: 'beta', videos: [video('beta-video', 'beta')] }]
      }
    })
    const manager = createManager(store, load, {
      retryDelaysMs: [125, 500],
      sleep
    })

    const state = await manager.refresh(ACCOUNT_A)

    expect(state.status).toBe('current')
    expect(load).toHaveBeenCalledTimes(2)
    expect(load.mock.calls[1][0].channelIds).toEqual(['beta'])
    expect(sleep).toHaveBeenCalledOnce()
    expect(sleep.mock.calls[0][0]).toBe(125)
    expect(state.snapshot?.lastCompleteSyncAt).toBe(NOW.toISOString())
  })

  it.each([
    ['quota_exhausted', new YouTubeSyncError('Cuota agotada.', { kind: 'quota_exhausted' })],
    ['token_expired', new YouTubeSyncError('Token caducado.', { kind: 'token_expired' })],
    ['permission_revoked', new YouTubeSyncError('Permiso revocado.', { kind: 'permission_revoked' })],
    ['invalid_response', new YouTubeSyncError('Respuesta inválida.', { kind: 'invalid_response' })]
  ] as const)('does not retry %s failures', async (_kind, failure) => {
    const store = new MemoryYouTubeCacheStore()
    const sleep = vi.fn(async () => {})
    const load = vi.fn<YouTubeSnapshotLoader>(async () => {
      throw failure
    })
    const manager = createManager(store, load, { retryDelaysMs: [10, 20], sleep })

    const state = await manager.refresh(ACCOUNT_A)

    expect(state.status).toBe('unavailable')
    expect(state.error?.kind).toBe(failure.kind)
    expect(load).toHaveBeenCalledOnce()
    expect(sleep).not.toHaveBeenCalled()
  })

  it('bounds recoverable global retries and exposes stale cache after failure', async () => {
    const store = new MemoryYouTubeCacheStore([
      snapshot({ updatedAt: isoBefore(YOUTUBE_CACHE_TTL_MS) })
    ])
    const sleep = vi.fn(async () => {})
    const failure = new YouTubeSyncError('Sin red.', { kind: 'network' })
    const load = vi.fn<YouTubeSnapshotLoader>(async () => {
      throw failure
    })
    const manager = createManager(store, load, { retryDelaysMs: [10, 20], sleep })

    const state = await manager.refresh(ACCOUNT_A)

    expect(load).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([10, 20])
    expect(state).toMatchObject({ status: 'stale', stale: true, refreshing: false })
    expect(state.error?.kind).toBe('network')
    expect(state.snapshot?.videos[0].id).toBe('old-alpha')
  })

  it('deletes only the disconnected account cache', async () => {
    const store = new MemoryYouTubeCacheStore([
      snapshot(),
      snapshot({ accountId: 'account-b' })
    ])
    const manager = createManager(store, vi.fn<YouTubeSnapshotLoader>())

    await manager.disconnect(ACCOUNT_A)

    expect(await store.get(ACCOUNT_A)).toBeNull()
    expect(await store.get('account-b')).not.toBeNull()
    expect(manager.getState(ACCOUNT_A).status).toBe('unavailable')
  })

  it('physically purges snapshots and channel data at 30 days', async () => {
    const expiredAt = isoBefore(YOUTUBE_CACHE_RETENTION_MS)
    const store = new MemoryYouTubeCacheStore([
      snapshot({ updatedAt: expiredAt, channelUpdatedAt: { alpha: expiredAt } })
    ])
    let previousSeen: YouTubeCacheSnapshot | null | undefined
    const load = vi.fn<YouTubeSnapshotLoader>(async ({ previous }) => {
      previousSeen = previous
      return completeLoad([video('fresh-alpha', 'alpha')])
    })
    const manager = createManager(store, load)

    const openingState = await manager.open(ACCOUNT_A)

    expect(openingState.status).toBe('unavailable')
    await vi.waitFor(() => expect(manager.getState(ACCOUNT_A).refreshing).toBe(false))
    expect(previousSeen).toBeNull()
    expect(store.purgedAccountIds).toContain(ACCOUNT_A)

    const staleChannelAt = isoBefore(YOUTUBE_CACHE_RETENTION_MS)
    await store.put(snapshot({
      subscriptions: [channel('alpha'), channel('beta')],
      videos: [video('old-alpha', 'alpha'), video('old-beta', 'beta')],
      channelUpdatedAt: { alpha: NOW.toISOString(), beta: staleChannelAt }
    }))
    const partialManager = createManager(store, vi.fn<YouTubeSnapshotLoader>(async () => ({
      subscriptions: [channel('alpha'), channel('beta')],
      channels: [
        { channelId: 'alpha', videos: [video('new-alpha', 'alpha')] },
        { channelId: 'beta', error: new YouTubeSyncError('Fallo.', { kind: 'invalid_response' }) }
      ]
    })), { retryDelaysMs: [] })

    const partial = await partialManager.refresh(ACCOUNT_A)

    expect(partial.snapshot?.videos.map(({ id }) => id)).toEqual(['new-alpha'])
    expect(partial.snapshot?.failedChannelIds).toEqual(['beta'])
    expect(partial.snapshot?.channelUpdatedAt.beta).toBeUndefined()
  })
})

describe('YouTube sync error classification', () => {
  it('maps API failures to stable application error kinds', () => {
    expect(normalizeYouTubeSyncError(new YouTubeApiError('Token', {
      kind: 'authorization', status: 401
    })).kind).toBe('token_expired')
    expect(normalizeYouTubeSyncError(new YouTubeApiError('Permiso', {
      kind: 'request', status: 403, reason: 'forbidden'
    })).kind).toBe('permission_revoked')
    expect(normalizeYouTubeSyncError(new YouTubeApiError('Cuota', {
      kind: 'quota', status: 403, reason: 'quotaExceeded'
    })).kind).toBe('quota_exhausted')
    expect(normalizeYouTubeSyncError(new YouTubeApiError('JSON', {
      kind: 'invalid_response', status: 200
    })).kind).toBe('invalid_response')

    const network = normalizeYouTubeSyncError(new YouTubeApiError('Servidor', {
      kind: 'request', status: 503
    }))
    expect(network).toMatchObject({ kind: 'network', recoverable: true })
  })
})

class MemoryYouTubeCacheStore implements YouTubeCacheStore {
  private snapshots = new Map<string, YouTubeCacheSnapshot>()
  readonly purgedAccountIds: string[] = []

  constructor(snapshots: YouTubeCacheSnapshot[] = []) {
    for (const value of snapshots) {
      this.snapshots.set(value.accountId, structuredClone(value))
    }
  }

  async get(accountId: string): Promise<YouTubeCacheSnapshot | null> {
    const value = this.snapshots.get(accountId)
    return value ? structuredClone(value) : null
  }

  async put(value: YouTubeCacheSnapshot): Promise<void> {
    this.snapshots.set(value.accountId, structuredClone(value))
  }

  async delete(accountId: string): Promise<void> {
    this.snapshots.delete(accountId)
  }

  async purgeExpired(now = new Date()): Promise<number> {
    let deleted = 0

    for (const [accountId, value] of this.snapshots) {
      if (now.getTime() - Date.parse(value.updatedAt) >= YOUTUBE_CACHE_RETENTION_MS) {
        this.snapshots.delete(accountId)
        this.purgedAccountIds.push(accountId)
        deleted += 1
      }
    }

    return deleted
  }
}

function createManager(
  store: YouTubeCacheStore,
  load: YouTubeSnapshotLoader,
  overrides: Partial<Parameters<typeof createYouTubeSyncManager>[0]> = {}
) {
  return createYouTubeSyncManager({
    store,
    load,
    now: () => new Date(NOW),
    sleep: async () => {},
    ...overrides
  })
}

function completeLoad(videos: PublishedVideo[]) {
  const subscriptions = [...new Set(videos.map(({ channelId }) => channelId))].map(channel)

  return {
    subscriptions,
    channels: subscriptions.map(({ id }) => ({
      channelId: id,
      videos: videos.filter((video) => video.channelId === id)
    }))
  }
}

function snapshot(overrides: Partial<YouTubeCacheSnapshot> = {}): YouTubeCacheSnapshot {
  const updatedAt = overrides.updatedAt ?? NOW.toISOString()

  return {
    version: 1,
    accountId: ACCOUNT_A,
    subscriptions: [channel('alpha')],
    videos: [video('old-alpha', 'alpha')],
    channelUpdatedAt: { alpha: updatedAt },
    updatedAt,
    lastCompleteSyncAt: updatedAt,
    failedChannelIds: [],
    ...overrides
  }
}

function channel(id: string): SubscribedChannel {
  return {
    id,
    title: `Channel ${id}`,
    avatarUrl: `https://example.com/${id}.jpg`,
    url: `https://youtube.com/channel/${id}`
  }
}

function video(id: string, channelId: string): PublishedVideo {
  return {
    id,
    channelId,
    title: id,
    publishedAt: '2026-09-18T12:00:00.000Z',
    durationIso: 'PT10M',
    durationSeconds: 600,
    thumbnailUrl: `https://example.com/${id}.jpg`,
    url: `https://youtube.com/watch?v=${id}`,
    liveStatus: 'none'
  }
}

function isoBefore(milliseconds: number): string {
  return new Date(NOW.getTime() - milliseconds).toISOString()
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}
