import type { PublishedVideo, SubscribedChannel } from './youtubeTypes'

export const YOUTUBE_CACHE_TTL_MS = 60 * 60 * 1000
export const YOUTUBE_CACHE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

const DATABASE_NAME = 'not-enough-time'
const DATABASE_VERSION = 1
const SNAPSHOT_STORE = 'youtube-api-snapshots'

export interface YouTubeCacheSnapshot {
  version: 1
  accountId: string
  subscriptions: SubscribedChannel[]
  videos: PublishedVideo[]
  channelUpdatedAt: Record<string, string>
  updatedAt: string
  lastCompleteSyncAt: string | null
  failedChannelIds: string[]
}

export interface YouTubeCacheStore {
  get(accountId: string): Promise<YouTubeCacheSnapshot | null>
  put(snapshot: YouTubeCacheSnapshot): Promise<void>
  delete(accountId: string): Promise<void>
  purgeExpired(now?: Date): Promise<number>
}

export interface IndexedDbYouTubeCacheOptions {
  indexedDB?: IDBFactory
  databaseName?: string
}

export interface IndexedDbYouTubeCacheStore extends YouTubeCacheStore {
  close(): void
}

export function createIndexedDbYouTubeCache(
  options: IndexedDbYouTubeCacheOptions = {}
): IndexedDbYouTubeCacheStore {
  const indexedDb = options.indexedDB ?? globalThis.indexedDB

  if (!indexedDb) {
    throw new Error('IndexedDB no está disponible en este navegador.')
  }

  let databasePromise: Promise<IDBDatabase> | null = null

  function openDatabase(): Promise<IDBDatabase> {
    databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDb.open(options.databaseName ?? DATABASE_NAME, DATABASE_VERSION)

      request.onupgradeneeded = () => {
        const database = request.result

        if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
          database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'accountId' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'))
      request.onblocked = () => reject(new Error('IndexedDB está bloqueado por otra pestaña.'))
    })

    return databasePromise
  }

  async function get(accountId: string): Promise<YouTubeCacheSnapshot | null> {
    assertAccountId(accountId)
    const database = await openDatabase()
    const transaction = database.transaction(SNAPSHOT_STORE, 'readonly')
    const done = transactionDone(transaction)
    const request = transaction.objectStore(SNAPSHOT_STORE).get(accountId)
    const value = await requestResult<unknown>(request)
    await done

    if (value === undefined) {
      return null
    }

    const snapshot = parseSnapshot(value, accountId)

    if (!snapshot) {
      await deleteSnapshot(accountId)
    }

    return snapshot
  }

  async function put(snapshot: YouTubeCacheSnapshot): Promise<void> {
    const parsed = parseSnapshot(snapshot, snapshot.accountId)

    if (!parsed) {
      throw new TypeError('La instantánea de YouTube no es válida.')
    }

    const database = await openDatabase()
    const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite')
    const done = transactionDone(transaction)
    transaction.objectStore(SNAPSHOT_STORE).put(parsed)
    await done
  }

  async function deleteSnapshot(accountId: string): Promise<void> {
    assertAccountId(accountId)
    const database = await openDatabase()
    const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite')
    const done = transactionDone(transaction)
    transaction.objectStore(SNAPSHOT_STORE).delete(accountId)
    await done
  }

  async function purgeExpired(now = new Date()): Promise<number> {
    const nowTime = validTime(now, 'La fecha de purga no es válida.')
    const database = await openDatabase()
    const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite')
    const done = transactionDone(transaction)
    const store = transaction.objectStore(SNAPSHOT_STORE)
    let deleted = 0

    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result

        if (!cursor) {
          resolve()
          return
        }

        const snapshot = parseSnapshot(cursor.value)
        const updatedTime = snapshot ? Date.parse(snapshot.updatedAt) : Number.NaN

        if (!snapshot || nowTime - updatedTime >= YOUTUBE_CACHE_RETENTION_MS) {
          cursor.delete()
          deleted += 1
        }

        cursor.continue()
      }
      request.onerror = () => reject(request.error ?? new Error('No se pudo recorrer la caché de YouTube.'))
    })

    await done
    return deleted
  }

  return {
    get,
    put,
    delete: deleteSnapshot,
    purgeExpired,
    close() {
      void databasePromise?.then((database) => database.close())
      databasePromise = null
    }
  }
}

export function isYouTubeCacheFresh(snapshot: YouTubeCacheSnapshot, now = new Date()): boolean {
  return validTime(now, 'La fecha actual no es válida.') - Date.parse(snapshot.updatedAt) < YOUTUBE_CACHE_TTL_MS
}

function parseSnapshot(value: unknown, expectedAccountId?: string): YouTubeCacheSnapshot | null {
  if (!isRecord(value) || value.version !== 1) {
    return null
  }

  const accountId = nonEmptyString(value.accountId)
  const updatedAt = isoDate(value.updatedAt)
  const lastCompleteSyncAt = value.lastCompleteSyncAt === null
    ? null
    : isoDate(value.lastCompleteSyncAt)

  if (
    !accountId ||
    (expectedAccountId !== undefined && accountId !== expectedAccountId) ||
    !updatedAt ||
    (value.lastCompleteSyncAt !== null && !lastCompleteSyncAt) ||
    !Array.isArray(value.subscriptions) ||
    !Array.isArray(value.videos) ||
    !isRecord(value.channelUpdatedAt) ||
    !Array.isArray(value.failedChannelIds)
  ) {
    return null
  }

  const subscriptions = value.subscriptions.map(parseChannel)
  const videos = value.videos.map(parseVideo)
  const channelUpdatedAt = Object.fromEntries(
    Object.entries(value.channelUpdatedAt)
      .map(([channelId, date]) => [nonEmptyString(channelId), isoDate(date)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))
  )
  const failedChannelIds = value.failedChannelIds.map(nonEmptyString)

  if (
    subscriptions.some((channel) => channel === null) ||
    videos.some((video) => video === null) ||
    failedChannelIds.some((channelId) => channelId === null)
  ) {
    return null
  }

  return {
    version: 1,
    accountId,
    subscriptions: subscriptions as SubscribedChannel[],
    videos: videos as PublishedVideo[],
    channelUpdatedAt,
    updatedAt,
    lastCompleteSyncAt,
    failedChannelIds: [...new Set(failedChannelIds as string[])]
  }
}

function parseChannel(value: unknown): SubscribedChannel | null {
  if (!isRecord(value)) {
    return null
  }

  const id = nonEmptyString(value.id)
  const title = nonEmptyString(value.title)
  const avatarUrl = nonEmptyString(value.avatarUrl)
  const url = nonEmptyString(value.url)

  return id && title && avatarUrl && url ? { id, title, avatarUrl, url } : null
}

function parseVideo(value: unknown): PublishedVideo | null {
  if (!isRecord(value)) {
    return null
  }

  const id = nonEmptyString(value.id)
  const channelId = nonEmptyString(value.channelId)
  const title = nonEmptyString(value.title)
  const publishedAt = isoDate(value.publishedAt)
  const durationIso = nonEmptyString(value.durationIso)
  const thumbnailUrl = nonEmptyString(value.thumbnailUrl)
  const url = nonEmptyString(value.url)
  const liveStatus = value.liveStatus

  if (
    !id || !channelId || !title || !publishedAt || !durationIso ||
    !Number.isFinite(value.durationSeconds) || Number(value.durationSeconds) < 0 ||
    !thumbnailUrl || !url ||
    !['none', 'upcoming', 'live', 'completed'].includes(String(liveStatus))
  ) {
    return null
  }

  const scheduledStartTime = optionalIsoDate(value.scheduledStartTime)
  const actualStartTime = optionalIsoDate(value.actualStartTime)
  const actualEndTime = optionalIsoDate(value.actualEndTime)

  if (scheduledStartTime === null || actualStartTime === null || actualEndTime === null) {
    return null
  }

  return {
    id,
    channelId,
    title,
    publishedAt,
    durationIso,
    durationSeconds: Number(value.durationSeconds),
    thumbnailUrl,
    url,
    liveStatus: liveStatus as PublishedVideo['liveStatus'],
    ...(scheduledStartTime ? { scheduledStartTime } : {}),
    ...(actualStartTime ? { actualStartTime } : {}),
    ...(actualEndTime ? { actualEndTime } : {})
  }
}

function optionalIsoDate(value: unknown): string | undefined | null {
  return value === undefined ? undefined : isoDate(value)
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function validTime(value: Date, message: string): number {
  const timestamp = value.getTime()

  if (!Number.isFinite(timestamp)) {
    throw new TypeError(message)
  }

  return timestamp
}

function assertAccountId(accountId: string): void {
  if (!accountId.trim()) {
    throw new TypeError('accountId no puede estar vacío.')
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('La operación IndexedDB ha fallado.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('La transacción IndexedDB ha fallado.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('La transacción IndexedDB fue cancelada.'))
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
