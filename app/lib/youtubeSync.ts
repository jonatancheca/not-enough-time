import { YouTubeApiError } from './youtubeApi'
import {
  isYouTubeCacheFresh,
  YOUTUBE_CACHE_RETENTION_MS,
  type YouTubeCacheSnapshot,
  type YouTubeCacheStore
} from './youtubeCache'
import type { PublishedVideo, SubscribedChannel } from './youtubeTypes'

export type YouTubeSyncStatus = 'current' | 'stale' | 'partial' | 'unavailable'
export type YouTubeSyncErrorKind =
  | 'network'
  | 'token_expired'
  | 'permission_revoked'
  | 'quota_exhausted'
  | 'invalid_response'
  | 'partial_channel'

export interface YouTubeChannelError {
  channelId: string
  kind: Exclude<YouTubeSyncErrorKind, 'partial_channel'>
  message: string
}

export class YouTubeSyncError extends Error {
  readonly kind: YouTubeSyncErrorKind
  readonly recoverable: boolean
  readonly status?: number
  readonly reason?: string
  readonly channelErrors: YouTubeChannelError[]

  constructor(
    message: string,
    options: {
      kind: YouTubeSyncErrorKind
      recoverable?: boolean
      status?: number
      reason?: string
      channelErrors?: YouTubeChannelError[]
      cause?: unknown
    }
  ) {
    super(message, { cause: options.cause })
    this.name = 'YouTubeSyncError'
    this.kind = options.kind
    this.recoverable = options.recoverable ?? options.kind === 'network'
    this.status = options.status
    this.reason = options.reason
    this.channelErrors = options.channelErrors ?? []
  }
}

export interface YouTubeChannelSyncSuccess {
  channelId: string
  videos: PublishedVideo[]
}

export interface YouTubeChannelSyncFailure {
  channelId: string
  error: unknown
}

export type YouTubeChannelSyncResult = YouTubeChannelSyncSuccess | YouTubeChannelSyncFailure

export interface YouTubeSyncLoadResult {
  subscriptions?: SubscribedChannel[]
  channels: YouTubeChannelSyncResult[]
}

export interface YouTubeSyncLoadContext {
  accountId: string
  signal: AbortSignal
  previous: YouTubeCacheSnapshot | null
  channelIds?: string[]
}

export type YouTubeSnapshotLoader = (
  context: YouTubeSyncLoadContext
) => Promise<YouTubeSyncLoadResult>

export interface YouTubeSyncState {
  accountId: string
  status: YouTubeSyncStatus
  snapshot: YouTubeCacheSnapshot | null
  refreshing: boolean
  stale: boolean
  partial: boolean
  error: YouTubeSyncError | null
}

export interface YouTubeSyncManager {
  open(accountId: string): Promise<YouTubeSyncState>
  refresh(accountId: string): Promise<YouTubeSyncState>
  disconnect(accountId: string): Promise<void>
  getState(accountId: string): YouTubeSyncState
  subscribe(accountId: string, listener: (state: YouTubeSyncState) => void): () => void
}

export interface YouTubeSyncManagerOptions {
  store: YouTubeCacheStore
  load: YouTubeSnapshotLoader
  now?: () => Date
  retryDelaysMs?: number[]
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>
}

interface ActiveSync {
  mode: 'auto' | 'manual'
  controller: AbortController
  promise: Promise<YouTubeSyncState>
}

interface LoadedChannels {
  subscriptions: SubscribedChannel[]
  channels: Map<string, NormalizedChannelResult>
}

type NormalizedChannelResult = YouTubeChannelSyncSuccess | {
  channelId: string
  error: YouTubeSyncError
}

const DEFAULT_RETRY_DELAYS_MS = [250, 1000]

export function createYouTubeSyncManager(options: YouTubeSyncManagerOptions): YouTubeSyncManager {
  const now = options.now ?? (() => new Date())
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
  const sleep = options.sleep ?? abortableSleep
  const states = new Map<string, YouTubeSyncState>()
  const listeners = new Map<string, Set<(state: YouTubeSyncState) => void>>()
  const activeSyncs = new Map<string, ActiveSync>()

  function getState(accountId: string): YouTubeSyncState {
    assertAccountId(accountId)
    return states.get(accountId) ?? unavailableState(accountId)
  }

  function emit(state: YouTubeSyncState): YouTubeSyncState {
    states.set(state.accountId, state)

    for (const listener of listeners.get(state.accountId) ?? []) {
      listener(state)
    }

    return state
  }

  async function open(accountId: string): Promise<YouTubeSyncState> {
    assertAccountId(accountId)
    const currentTime = currentDate(now)
    await options.store.purgeExpired(currentTime)
    const snapshot = pruneExpiredChannelData(await options.store.get(accountId), currentTime)

    if (snapshot) {
      await options.store.put(snapshot)
    }

    const fresh = snapshot ? isYouTubeCacheFresh(snapshot, currentTime) : false
    const state = emit(stateFromSnapshot(
      accountId,
      snapshot,
      !fresh,
      activeSyncs.has(accountId),
      null
    ))

    if (!fresh) {
      void startSync(accountId, 'auto')
    }

    return states.get(accountId) ?? state
  }

  function refresh(accountId: string): Promise<YouTubeSyncState> {
    assertAccountId(accountId)
    return startSync(accountId, 'manual')
  }

  async function disconnect(accountId: string): Promise<void> {
    assertAccountId(accountId)
    const active = activeSyncs.get(accountId)

    if (active) {
      activeSyncs.delete(accountId)
      active.controller.abort(new DOMException('La sincronización se canceló al desconectar.', 'AbortError'))
      await active.promise
    }

    await options.store.delete(accountId)
    emit(unavailableState(accountId))
  }

  function startSync(accountId: string, mode: ActiveSync['mode']): Promise<YouTubeSyncState> {
    const existing = activeSyncs.get(accountId)

    if (existing?.mode === 'manual' || (existing && mode === 'auto')) {
      return existing.promise
    }

    if (existing?.mode === 'auto' && mode === 'manual') {
      existing.controller.abort(new DOMException('La actualización manual sustituye a la automática.', 'AbortError'))
    }

    const controller = new AbortController()
    let operation: ActiveSync
    const promise = runSync(accountId, controller).finally(() => {
      if (activeSyncs.get(accountId) === operation) {
        activeSyncs.delete(accountId)
      }
    })
    operation = { mode, controller, promise }
    activeSyncs.set(accountId, operation)
    return promise
  }

  async function runSync(accountId: string, controller: AbortController): Promise<YouTubeSyncState> {
    let previous = states.get(accountId)?.snapshot ?? await options.store.get(accountId)
    const startedAt = currentDate(now)
    previous = pruneExpiredChannelData(previous, startedAt)
    const before = stateFromSnapshot(
      accountId,
      previous,
      previous ? !isYouTubeCacheFresh(previous, startedAt) : false,
      true,
      null
    )
    emit(before)

    try {
      const loaded = await loadWithRetries(accountId, previous, controller.signal)
      throwIfAborted(controller.signal)
      const completedAt = currentDate(now)
      const snapshot = mergeSnapshot(accountId, previous, loaded, completedAt)
      await options.store.put(snapshot)
      throwIfAborted(controller.signal)

      if (!isCurrentOperation(accountId, controller)) {
        return getState(accountId)
      }

      const failures = [...loaded.channels.values()].filter(isNormalizedFailure)
      const error = failures.length > 0 ? partialError(failures) : null
      return emit(stateFromSnapshot(accountId, snapshot, false, false, error))
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted || !isCurrentOperation(accountId, controller)) {
        return getState(accountId)
      }

      const syncError = normalizeYouTubeSyncError(error)
      const currentTime = currentDate(now)
      const cached = pruneExpiredChannelData(previous, currentTime)
      return emit(stateFromSnapshot(
        accountId,
        cached,
        cached ? !isYouTubeCacheFresh(cached, currentTime) : false,
        false,
        syncError
      ))
    }
  }

  async function loadWithRetries(
    accountId: string,
    previous: YouTubeCacheSnapshot | null,
    signal: AbortSignal
  ): Promise<LoadedChannels> {
    const initial = await loadGlobalWithRetries({ accountId, previous, signal })

    if (!initial.subscriptions) {
      throw new YouTubeSyncError('La sincronización no devolvió suscripciones.', {
        kind: 'invalid_response'
      })
    }

    const subscriptions = uniqueChannels(initial.subscriptions)
    const expectedChannelIds = new Set(subscriptions.map((channel) => channel.id))
    const channels = normalizeChannelResults(initial.channels, expectedChannelIds)
    addMissingChannelFailures(channels, expectedChannelIds)

    for (const delayMs of retryDelaysMs) {
      const retryableChannelIds = [...channels.values()]
        .filter(isNormalizedFailure)
        .filter((result) => result.error.recoverable)
        .map((result) => result.channelId)

      if (retryableChannelIds.length === 0) {
        break
      }

      await sleep(delayMs, signal)
      throwIfAborted(signal)

      try {
        const retried = await options.load({
          accountId,
          previous,
          signal,
          channelIds: retryableChannelIds
        })
        const retrySet = new Set(retryableChannelIds)
        const retriedChannels = normalizeChannelResults(retried.channels, retrySet)

        for (const channelId of retryableChannelIds) {
          channels.set(channelId, retriedChannels.get(channelId) ?? invalidChannelResult(channelId))
        }
      } catch (error) {
        if (isAbortError(error) || signal.aborted) {
          throw error
        }

        const syncError = normalizeYouTubeSyncError(error)

        if (!syncError.recoverable) {
          for (const channelId of retryableChannelIds) {
            channels.set(channelId, { channelId, error: syncError })
          }
          break
        }
      }
    }

    return { subscriptions, channels }
  }

  async function loadGlobalWithRetries(context: YouTubeSyncLoadContext): Promise<YouTubeSyncLoadResult> {
    let attempt = 0

    while (true) {
      throwIfAborted(context.signal)

      try {
        return await options.load(context)
      } catch (error) {
        if (isAbortError(error) || context.signal.aborted) {
          throw error
        }

        const syncError = normalizeYouTubeSyncError(error)
        const delayMs = retryDelaysMs[attempt]

        if (!syncError.recoverable || delayMs === undefined) {
          throw syncError
        }

        attempt += 1
        await sleep(delayMs, context.signal)
      }
    }
  }

  function isCurrentOperation(accountId: string, controller: AbortController): boolean {
    return activeSyncs.get(accountId)?.controller === controller
  }

  return {
    open,
    refresh,
    disconnect,
    getState,
    subscribe(accountId, listener) {
      assertAccountId(accountId)
      const accountListeners = listeners.get(accountId) ?? new Set()
      accountListeners.add(listener)
      listeners.set(accountId, accountListeners)
      listener(getState(accountId))

      return () => {
        accountListeners.delete(listener)

        if (accountListeners.size === 0) {
          listeners.delete(accountId)
        }
      }
    }
  }
}

export function normalizeYouTubeSyncError(error: unknown): YouTubeSyncError {
  if (error instanceof YouTubeSyncError) {
    return error
  }

  if (error instanceof YouTubeApiError) {
    if (error.kind === 'network' || (error.kind === 'request' && isRecoverableStatus(error.status))) {
      return new YouTubeSyncError(error.message, {
        kind: 'network',
        recoverable: true,
        status: error.status,
        reason: error.reason,
        cause: error
      })
    }

    if (error.kind === 'authorization') {
      return new YouTubeSyncError(error.message, {
        kind: 'token_expired',
        status: error.status,
        reason: error.reason,
        cause: error
      })
    }

    if (error.kind === 'quota') {
      return new YouTubeSyncError(error.message, {
        kind: 'quota_exhausted',
        status: error.status,
        reason: error.reason,
        cause: error
      })
    }

    if (error.kind === 'request' && error.status === 403) {
      return new YouTubeSyncError(error.message, {
        kind: 'permission_revoked',
        status: error.status,
        reason: error.reason,
        cause: error
      })
    }

    return new YouTubeSyncError(error.message, {
      kind: 'invalid_response',
      status: error.status,
      reason: error.reason,
      cause: error
    })
  }

  return new YouTubeSyncError('No se pudo interpretar la respuesta de YouTube.', {
    kind: 'invalid_response',
    cause: error
  })
}

function mergeSnapshot(
  accountId: string,
  previous: YouTubeCacheSnapshot | null,
  loaded: LoadedChannels,
  completedAt: Date
): YouTubeCacheSnapshot {
  const completedAtIso = completedAt.toISOString()
  const completedAtTime = completedAt.getTime()
  const previousVideosByChannel = groupVideosByChannel(previous?.videos ?? [])
  const videos: PublishedVideo[] = []
  const channelUpdatedAt: Record<string, string> = {}
  const failedChannelIds: string[] = []

  for (const subscription of loaded.subscriptions) {
    const result = loaded.channels.get(subscription.id) ?? invalidChannelResult(subscription.id)

    if (!isNormalizedFailure(result)) {
      videos.push(...result.videos.filter((video) => video.channelId === subscription.id))
      channelUpdatedAt[subscription.id] = completedAtIso
      continue
    }

    failedChannelIds.push(subscription.id)
    const previousUpdatedAt = previous?.channelUpdatedAt[subscription.id]
    const previousUpdatedTime = previousUpdatedAt ? Date.parse(previousUpdatedAt) : Number.NaN

    if (
      Number.isFinite(previousUpdatedTime) &&
      completedAtTime - previousUpdatedTime < YOUTUBE_CACHE_RETENTION_MS
    ) {
      videos.push(...(previousVideosByChannel.get(subscription.id) ?? []))
      channelUpdatedAt[subscription.id] = previousUpdatedAt!
    }
  }

  const complete = failedChannelIds.length === 0

  return {
    version: 1,
    accountId,
    subscriptions: loaded.subscriptions,
    videos: uniqueVideos(videos),
    channelUpdatedAt,
    updatedAt: completedAtIso,
    lastCompleteSyncAt: complete ? completedAtIso : previous?.lastCompleteSyncAt ?? null,
    failedChannelIds
  }
}

function pruneExpiredChannelData(
  snapshot: YouTubeCacheSnapshot | null,
  now: Date
): YouTubeCacheSnapshot | null {
  if (!snapshot) {
    return null
  }

  const nowTime = now.getTime()
  const retainedChannelIds = new Set(
    Object.entries(snapshot.channelUpdatedAt)
      .filter(([, updatedAt]) => nowTime - Date.parse(updatedAt) < YOUTUBE_CACHE_RETENTION_MS)
      .map(([channelId]) => channelId)
  )

  return {
    ...snapshot,
    videos: snapshot.videos.filter((video) => retainedChannelIds.has(video.channelId)),
    channelUpdatedAt: Object.fromEntries(
      Object.entries(snapshot.channelUpdatedAt).filter(([channelId]) => retainedChannelIds.has(channelId))
    ),
    failedChannelIds: snapshot.failedChannelIds.filter((channelId) =>
      snapshot.subscriptions.some((channel) => channel.id === channelId)
    )
  }
}

function stateFromSnapshot(
  accountId: string,
  snapshot: YouTubeCacheSnapshot | null,
  stale: boolean,
  refreshing: boolean,
  error: YouTubeSyncError | null
): YouTubeSyncState {
  const partial = Boolean(snapshot?.failedChannelIds.length)
  const status: YouTubeSyncStatus = !snapshot
    ? 'unavailable'
    : partial
      ? 'partial'
      : stale
        ? 'stale'
        : 'current'

  return { accountId, status, snapshot, refreshing, stale, partial, error }
}

function unavailableState(accountId: string): YouTubeSyncState {
  return {
    accountId,
    status: 'unavailable',
    snapshot: null,
    refreshing: false,
    stale: false,
    partial: false,
    error: null
  }
}

function normalizeChannelResults(
  results: YouTubeChannelSyncResult[],
  expectedChannelIds: Set<string>
): Map<string, NormalizedChannelResult> {
  const normalized = new Map<string, NormalizedChannelResult>()

  for (const result of results) {
    if (!expectedChannelIds.has(result.channelId) || normalized.has(result.channelId)) {
      continue
    }

    if ('videos' in result) {
      normalized.set(result.channelId, {
        channelId: result.channelId,
        videos: uniqueVideos(result.videos)
      })
    } else {
      normalized.set(result.channelId, {
        channelId: result.channelId,
        error: normalizeYouTubeSyncError(result.error)
      })
    }
  }

  return normalized
}

function addMissingChannelFailures(
  results: Map<string, NormalizedChannelResult>,
  channelIds: Set<string>
): void {
  for (const channelId of channelIds) {
    if (!results.has(channelId)) {
      results.set(channelId, invalidChannelResult(channelId))
    }
  }
}

function invalidChannelResult(channelId: string): NormalizedChannelResult {
  return {
    channelId,
    error: new YouTubeSyncError(`Falta el resultado del canal ${channelId}.`, {
      kind: 'invalid_response'
    })
  }
}

function partialError(failures: Array<{ channelId: string, error: YouTubeSyncError }>): YouTubeSyncError {
  const channelErrors = failures.map(({ channelId, error }) => ({
    channelId,
    kind: error.kind === 'partial_channel' ? 'invalid_response' as const : error.kind,
    message: error.message
  }))

  return new YouTubeSyncError(
    `No se pudieron actualizar ${failures.length} canal${failures.length === 1 ? '' : 'es'}.`,
    { kind: 'partial_channel', channelErrors }
  )
}

function isNormalizedFailure(
  result: NormalizedChannelResult
): result is { channelId: string, error: YouTubeSyncError } {
  return 'error' in result
}

function uniqueChannels(channels: SubscribedChannel[]): SubscribedChannel[] {
  const unique = new Map<string, SubscribedChannel>()

  for (const channel of channels) {
    if (channel.id.trim() && !unique.has(channel.id)) {
      unique.set(channel.id, channel)
    }
  }

  return [...unique.values()]
}

function uniqueVideos(videos: PublishedVideo[]): PublishedVideo[] {
  const unique = new Map<string, PublishedVideo>()

  for (const video of videos) {
    if (!unique.has(video.id)) {
      unique.set(video.id, video)
    }
  }

  return [...unique.values()].toSorted(
    (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
  )
}

function groupVideosByChannel(videos: PublishedVideo[]): Map<string, PublishedVideo[]> {
  const grouped = new Map<string, PublishedVideo[]>()

  for (const video of videos) {
    const channelVideos = grouped.get(video.channelId) ?? []
    channelVideos.push(video)
    grouped.set(video.channelId, channelVideos)
  }

  return grouped
}

function isRecoverableStatus(status?: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500)
}

function currentDate(now: () => Date): Date {
  const value = now()

  if (!Number.isFinite(value.getTime())) {
    throw new TypeError('La fecha actual no es válida.')
  }

  return new Date(value)
}

function assertAccountId(accountId: string): void {
  if (!accountId.trim()) {
    throw new TypeError('accountId no puede estar vacío.')
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('La sincronización fue cancelada.', 'AbortError')
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function abortableSleep(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal)
    const onAbort = () => {
      clearTimeout(timeout)
      reject(signal.reason instanceof Error
        ? signal.reason
        : new DOMException('La espera fue cancelada.', 'AbortError'))
    }
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)

    signal.addEventListener('abort', onAbort, { once: true })
  })
}
