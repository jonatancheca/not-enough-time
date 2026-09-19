import { parseYouTubeDurationToSeconds } from './watchload'
import type {
  PublishedVideo,
  SubscribedChannel,
  YouTubeClient,
  YouTubeLiveStatus,
  YouTubeRequestOptions,
  YouTubeUploadReference
} from './youtubeTypes'

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3'
const MAX_BATCH_SIZE = 50

export type YouTubeApiErrorKind =
  | 'authorization'
  | 'quota'
  | 'request'
  | 'network'
  | 'invalid_response'

export class YouTubeApiError extends Error {
  readonly kind: YouTubeApiErrorKind
  readonly status?: number
  readonly reason?: string

  constructor(
    message: string,
    options: {
      kind: YouTubeApiErrorKind
      status?: number
      reason?: string
      cause?: unknown
    }
  ) {
    super(message, { cause: options.cause })
    this.name = 'YouTubeApiError'
    this.kind = options.kind
    this.status = options.status
    this.reason = options.reason
  }
}

export interface YouTubeApiClientOptions {
  getAccessToken: () => string | null
  fetcher?: typeof fetch
  now?: () => Date
}

interface YouTubeListResponse {
  items: unknown[]
  nextPageToken?: string
}

interface UploadPlaylist {
  channelId: string
  playlistId: string
}

export function createYouTubeApiClient(options: YouTubeApiClientOptions): YouTubeClient {
  const fetcher = options.fetcher ?? globalThis.fetch
  const now = options.now ?? (() => new Date())

  async function request(
    resource: string,
    query: Record<string, string>,
    requestOptions?: YouTubeRequestOptions
  ): Promise<YouTubeListResponse> {
    throwIfAborted(requestOptions?.signal)

    const accessToken = options.getAccessToken()

    if (!accessToken) {
      throw new YouTubeApiError('Necesitas una autorización vigente de YouTube.', {
        kind: 'authorization'
      })
    }

    const url = new URL(`${YOUTUBE_API_BASE_URL}/${resource}`)

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }

    let response: Response

    try {
      response = await fetcher(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        signal: requestOptions?.signal
      })
    } catch (error) {
      if (isAbortError(error) || requestOptions?.signal?.aborted) {
        throwAbort(requestOptions?.signal)
      }

      throw new YouTubeApiError('No se pudo contactar con YouTube.', {
        kind: 'network',
        cause: error
      })
    }

    throwIfAborted(requestOptions?.signal)

    const body = await readJson(response, requestOptions?.signal)

    if (!response.ok) {
      throw createResponseError(response.status, body)
    }

    if (!isRecord(body) || !Array.isArray(body.items)) {
      throw new YouTubeApiError('YouTube devolvió una respuesta no válida.', {
        kind: 'invalid_response',
        status: response.status
      })
    }

    const nextPageToken = stringValue(body.nextPageToken)

    return {
      items: body.items,
      ...(nextPageToken ? { nextPageToken } : {})
    }
  }

  async function getMyChannelId(
    requestOptions?: YouTubeRequestOptions
  ): Promise<string> {
    const response = await request('channels', {
      part: 'id',
      mine: 'true',
      maxResults: '1'
    }, requestOptions)
    const channelId = response.items
      .map((item) => isRecord(item) ? stringValue(item.id) : undefined)
      .find(Boolean)

    if (!channelId) {
      throw new YouTubeApiError('La cuenta autorizada no tiene un canal de YouTube identificable.', {
        kind: 'invalid_response'
      })
    }

    return channelId
  }

  async function listMySubscriptions(
    requestOptions?: YouTubeRequestOptions
  ): Promise<SubscribedChannel[]> {
    const subscriptions = new Map<string, SubscribedChannel>()
    let pageToken: string | undefined

    do {
      const response = await request('subscriptions', {
        part: 'snippet',
        mine: 'true',
        maxResults: String(MAX_BATCH_SIZE),
        ...(pageToken ? { pageToken } : {})
      }, requestOptions)

      for (const item of response.items) {
        const channel = normalizeSubscription(item)

        if (channel && !subscriptions.has(channel.id)) {
          subscriptions.set(channel.id, channel)
        }
      }

      pageToken = response.nextPageToken
    } while (pageToken)

    throwIfAborted(requestOptions?.signal)
    return [...subscriptions.values()]
  }

  async function listRecentUploads(
    channelIds: string[],
    publishedAfter: string,
    requestOptions?: YouTubeRequestOptions
  ): Promise<YouTubeUploadReference[]> {
    const publishedAfterTime = parseRequiredDate(publishedAfter, 'El límite temporal no es válido.')
    const nowTime = now().getTime()

    if (!Number.isFinite(nowTime)) {
      throw new YouTubeApiError('El reloj usado para consultar YouTube no es válido.', {
        kind: 'invalid_response'
      })
    }

    const playlists = await listUploadPlaylists(uniqueNonEmpty(channelIds), requestOptions)
    const uploads = new Map<string, YouTubeUploadReference>()

    for (const playlist of playlists) {
      let pageToken: string | undefined
      let reachedOlderUpload = false

      do {
        const response = await request('playlistItems', {
          part: 'snippet,contentDetails',
          playlistId: playlist.playlistId,
          maxResults: String(MAX_BATCH_SIZE),
          ...(pageToken ? { pageToken } : {})
        }, requestOptions)

        for (const item of response.items) {
          const upload = normalizeUploadReference(item, playlist.channelId)

          if (!upload) {
            continue
          }

          const publishedTime = new Date(upload.publishedAt).getTime()

          if (publishedTime < publishedAfterTime) {
            reachedOlderUpload = true
            continue
          }

          if (publishedTime <= nowTime && !uploads.has(upload.id)) {
            uploads.set(upload.id, upload)
          }
        }

        pageToken = reachedOlderUpload ? undefined : response.nextPageToken
      } while (pageToken)
    }

    throwIfAborted(requestOptions?.signal)
    return [...uploads.values()].toSorted(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    )
  }

  async function listUploadPlaylists(
    channelIds: string[],
    requestOptions?: YouTubeRequestOptions
  ): Promise<UploadPlaylist[]> {
    const playlists: UploadPlaylist[] = []

    for (const channelBatch of batches(channelIds, MAX_BATCH_SIZE)) {
      const response = await request('channels', {
        part: 'snippet,contentDetails',
        id: channelBatch.join(','),
        maxResults: String(MAX_BATCH_SIZE)
      }, requestOptions)

      for (const item of response.items) {
        const playlist = normalizeUploadPlaylist(item)

        if (playlist) {
          playlists.push(playlist)
        }
      }
    }

    return playlists
  }

  async function listVideoDetails(
    videoIds: string[],
    requestOptions?: YouTubeRequestOptions
  ): Promise<PublishedVideo[]> {
    const videos = new Map<string, PublishedVideo>()
    const nowTime = now().getTime()

    if (!Number.isFinite(nowTime)) {
      throw new YouTubeApiError('El reloj usado para consultar YouTube no es válido.', {
        kind: 'invalid_response'
      })
    }

    for (const videoBatch of batches(uniqueNonEmpty(videoIds), MAX_BATCH_SIZE)) {
      const response = await request('videos', {
        part: 'snippet,contentDetails,liveStreamingDetails',
        id: videoBatch.join(','),
        maxResults: String(MAX_BATCH_SIZE)
      }, requestOptions)

      for (const item of response.items) {
        const video = normalizeVideo(item)

        if (
          video &&
          new Date(video.publishedAt).getTime() <= nowTime &&
          !videos.has(video.id)
        ) {
          videos.set(video.id, video)
        }
      }
    }

    throwIfAborted(requestOptions?.signal)
    return [...videos.values()]
  }

  return {
    getMyChannelId,
    listMySubscriptions,
    listRecentUploads,
    listVideoDetails
  }
}

function normalizeSubscription(value: unknown): SubscribedChannel | null {
  if (!isRecord(value) || !isRecord(value.snippet)) {
    return null
  }

  const snippet = value.snippet
  const channelId = isRecord(snippet.resourceId)
    ? stringValue(snippet.resourceId.channelId)
    : undefined
  const title = stringValue(snippet.title)
  const avatarUrl = thumbnailUrl(snippet.thumbnails)

  if (!channelId || !title || !avatarUrl) {
    return null
  }

  return {
    id: channelId,
    title,
    avatarUrl,
    url: `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`
  }
}

function normalizeUploadPlaylist(value: unknown): UploadPlaylist | null {
  if (!isRecord(value) || !isRecord(value.contentDetails)) {
    return null
  }

  const channelId = stringValue(value.id)
  const playlistId = isRecord(value.contentDetails.relatedPlaylists)
    ? stringValue(value.contentDetails.relatedPlaylists.uploads)
    : undefined

  return channelId && playlistId ? { channelId, playlistId } : null
}

function normalizeUploadReference(
  value: unknown,
  fallbackChannelId: string
): YouTubeUploadReference | null {
  if (!isRecord(value)) {
    return null
  }

  const snippet = isRecord(value.snippet) ? value.snippet : undefined
  const contentDetails = isRecord(value.contentDetails) ? value.contentDetails : undefined
  const idFromContent = contentDetails ? stringValue(contentDetails.videoId) : undefined
  const idFromSnippet = snippet && isRecord(snippet.resourceId)
    ? stringValue(snippet.resourceId.videoId)
    : undefined
  const publishedAt = normalizeIsoDate(
    contentDetails?.videoPublishedAt ?? snippet?.publishedAt
  )
  const channelId = snippet ? stringValue(snippet.videoOwnerChannelId) : undefined

  if (!(idFromContent ?? idFromSnippet) || !publishedAt) {
    return null
  }

  return {
    id: (idFromContent ?? idFromSnippet)!,
    channelId: channelId ?? fallbackChannelId,
    publishedAt
  }
}

function normalizeVideo(value: unknown): PublishedVideo | null {
  if (!isRecord(value) || !isRecord(value.snippet) || !isRecord(value.contentDetails)) {
    return null
  }

  const id = stringValue(value.id)
  const title = stringValue(value.snippet.title)
  const channelId = stringValue(value.snippet.channelId)
  const publishedAt = normalizeIsoDate(value.snippet.publishedAt)
  const durationIso = stringValue(value.contentDetails.duration)
  const imageUrl = thumbnailUrl(value.snippet.thumbnails)

  if (!id || !title || !channelId || !publishedAt || !durationIso || !imageUrl) {
    return null
  }

  let durationSeconds: number

  try {
    durationSeconds = parseYouTubeDurationToSeconds(durationIso)
  } catch {
    return null
  }

  const liveStreamingDetails = isRecord(value.liveStreamingDetails)
    ? value.liveStreamingDetails
    : undefined
  const liveStatus = normalizeLiveStatus(
    stringValue(value.snippet.liveBroadcastContent),
    liveStreamingDetails
  )
  const scheduledStartTime = normalizeIsoDate(liveStreamingDetails?.scheduledStartTime)
  const actualStartTime = normalizeIsoDate(liveStreamingDetails?.actualStartTime)
  const actualEndTime = normalizeIsoDate(liveStreamingDetails?.actualEndTime)

  return {
    id,
    channelId,
    title,
    publishedAt,
    durationIso,
    durationSeconds,
    thumbnailUrl: imageUrl,
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
    liveStatus,
    ...(scheduledStartTime ? { scheduledStartTime } : {}),
    ...(actualStartTime ? { actualStartTime } : {}),
    ...(actualEndTime ? { actualEndTime } : {})
  }
}

function normalizeLiveStatus(
  snippetStatus: string | undefined,
  details: Record<string, unknown> | undefined
): YouTubeLiveStatus {
  if (snippetStatus === 'live' || snippetStatus === 'upcoming') {
    return snippetStatus
  }

  if (normalizeIsoDate(details?.actualStartTime) || normalizeIsoDate(details?.actualEndTime)) {
    return 'completed'
  }

  return 'none'
}

function thumbnailUrl(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  for (const size of ['maxres', 'standard', 'high', 'medium', 'default']) {
    const thumbnail = value[size]

    if (isRecord(thumbnail)) {
      const url = stringValue(thumbnail.url)

      if (url) {
        return url
      }
    }
  }

  return undefined
}

async function readJson(response: Response, signal?: AbortSignal): Promise<unknown> {
  try {
    const body: unknown = await response.json()
    throwIfAborted(signal)
    return body
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      throwAbort(signal)
    }

    throw new YouTubeApiError('YouTube devolvió una respuesta que no se puede leer.', {
      kind: 'invalid_response',
      status: response.status,
      cause: error
    })
  }
}

function createResponseError(status: number, body: unknown): YouTubeApiError {
  const apiError = isRecord(body) && isRecord(body.error) ? body.error : undefined
  const message = stringValue(apiError?.message)
  const errors = Array.isArray(apiError?.errors) ? apiError.errors : []
  const firstError = errors.find(isRecord)
  const reason = firstError ? stringValue(firstError.reason) : undefined
  const kind: YouTubeApiErrorKind = status === 401
    ? 'authorization'
    : status === 403 && isQuotaReason(reason)
      ? 'quota'
      : 'request'

  return new YouTubeApiError(
    message ? `YouTube rechazó la petición: ${message}` : `YouTube rechazó la petición (${status}).`,
    { kind, status, ...(reason ? { reason } : {}) }
  )
}

function isQuotaReason(reason?: string): boolean {
  return reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded'
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function batches<T>(values: T[], batchSize: number): T[][] {
  const result: T[][] = []

  for (let index = 0; index < values.length; index += batchSize) {
    result.push(values.slice(index, index + batchSize))
  }

  return result
}

function parseRequiredDate(value: string, message: string): number {
  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) {
    throw new YouTubeApiError(message, { kind: 'invalid_response' })
  }

  return timestamp
}

function normalizeIsoDate(value: unknown): string | undefined {
  const date = stringValue(value)

  if (!date) {
    return undefined
  }

  const timestamp = new Date(date).getTime()
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throwAbort(signal)
  }
}

function throwAbort(signal?: AbortSignal): never {
  if (signal?.reason instanceof Error) {
    throw signal.reason
  }

  throw new DOMException('The operation was aborted.', 'AbortError')
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
