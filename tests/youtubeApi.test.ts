import { describe, expect, it, vi } from 'vitest'
import {
  createYouTubeApiClient,
  YouTubeApiError
} from '../app/lib/youtubeApi'

const now = new Date('2026-09-19T12:00:00.000Z')
const cutoff = new Date('2026-08-20T12:00:00.000Z').toISOString()

describe('YouTube Data API client', () => {
  it('paginates all subscriptions with maxResults 50 and bearer authorization', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))

      if (url.searchParams.get('pageToken') === 'second-page') {
        return jsonResponse({
          items: [subscriptionItem('channel-2', 'Channel Two')]
        })
      }

      return jsonResponse({
        items: [subscriptionItem('channel-1', 'Channel One')],
        nextPageToken: 'second-page'
      })
    })
    const client = createClient(fetcher)

    const subscriptions = await client.listMySubscriptions()

    expect(subscriptions.map((channel) => channel.id)).toEqual(['channel-1', 'channel-2'])
    expect(subscriptions[0]).toEqual({
      id: 'channel-1',
      title: 'Channel One',
      avatarUrl: 'https://example.com/channel-1.jpg',
      url: 'https://www.youtube.com/channel/channel-1'
    })
    expect(fetcher).toHaveBeenCalledTimes(2)

    for (const [input, init] of fetcher.mock.calls) {
      const url = new URL(String(input))
      const headers = new Headers(init?.headers)

      expect(url.pathname).toBe('/youtube/v3/subscriptions')
      expect(url.searchParams.get('part')).toBe('snippet')
      expect(url.searchParams.get('mine')).toBe('true')
      expect(url.searchParams.get('maxResults')).toBe('50')
      expect(url.searchParams.has('key')).toBe(false)
      expect(init?.mode).toBe('cors')
      expect(headers.get('Authorization')).toBe('Bearer memory-token')
    }
  })

  it('batches channel lookups at 50 IDs and visits every uploads playlist', async () => {
    const channelIds = Array.from({ length: 51 }, (_, index) => `channel-${index}`)
    const channelRequestSizes: number[] = []
    const visitedPlaylists: string[] = []
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      if (url.pathname.endsWith('/channels')) {
        const ids = url.searchParams.get('id')?.split(',') ?? []
        channelRequestSizes.push(ids.length)
        return jsonResponse({ items: ids.map(channelItem) })
      }

      visitedPlaylists.push(url.searchParams.get('playlistId') ?? '')
      return jsonResponse({ items: [] })
    })
    const client = createClient(fetcher)

    await client.listRecentUploads(channelIds, cutoff)

    expect(channelRequestSizes).toEqual([50, 1])
    expect(visitedPlaylists).toHaveLength(51)
    expect(new Set(visitedPlaylists).size).toBe(51)
  })

  it('paginates uploads until older than inclusive cutoff, deduplicating and excluding future items', async () => {
    const playlistCalls = new Map<string, number>()
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      if (url.pathname.endsWith('/channels')) {
        return jsonResponse({
          items: [channelItem('channel-a'), channelItem('channel-b')]
        })
      }

      const playlistId = url.searchParams.get('playlistId') ?? ''
      playlistCalls.set(playlistId, (playlistCalls.get(playlistId) ?? 0) + 1)

      if (playlistId === 'uploads-channel-a' && !url.searchParams.has('pageToken')) {
        return jsonResponse({
          items: [
            uploadItem('future', 'channel-a', '2026-09-20T00:00:00.000Z'),
            uploadItem('recent', 'channel-a', '2026-09-18T00:00:00.000Z')
          ],
          nextPageToken: 'a-page-2'
        })
      }

      if (playlistId === 'uploads-channel-a') {
        return jsonResponse({
          items: [
            uploadItem('boundary', 'channel-a', cutoff),
            uploadItem('too-old', 'channel-a', '2026-08-20T11:59:59.000Z')
          ],
          nextPageToken: 'must-not-be-requested'
        })
      }

      return jsonResponse({
        items: [
          uploadItem('recent', 'channel-a', '2026-09-18T00:00:00.000Z'),
          uploadItem('second-channel', 'channel-b', '2026-09-10T00:00:00.000Z')
        ]
      })
    })
    const client = createClient(fetcher)

    const uploads = await client.listRecentUploads(['channel-a', 'channel-b'], cutoff)

    expect(uploads.map((upload) => upload.id)).toEqual([
      'recent',
      'second-channel',
      'boundary'
    ])
    expect(playlistCalls.get('uploads-channel-a')).toBe(2)
    expect(playlistCalls.get('uploads-channel-b')).toBe(1)
  })

  it('batches video details and normalizes live metadata while skipping unusable results', async () => {
    const ids = Array.from({ length: 51 }, (_, index) => `video-${index}`)
    const videoRequestSizes: number[] = []
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const requestedIds = url.searchParams.get('id')?.split(',') ?? []
      videoRequestSizes.push(requestedIds.length)

      if (requestedIds.includes('video-0')) {
        return jsonResponse({
          items: [
            videoItem('video-0', {
              liveBroadcastContent: 'live',
              liveStreamingDetails: {
                scheduledStartTime: '2026-09-19T10:00:00Z',
                actualStartTime: '2026-09-19T10:05:00Z'
              }
            }),
            videoItem('video-1', {
              liveStreamingDetails: {
                actualStartTime: '2026-09-18T10:00:00Z',
                actualEndTime: '2026-09-18T11:00:00Z'
              }
            }),
            videoItem('future-video', { publishedAt: '2026-09-20T00:00:00Z' }),
            { id: 'private-without-details', snippet: { title: 'Private video' } }
          ]
        })
      }

      return jsonResponse({
        items: [videoItem('video-50', { liveBroadcastContent: 'upcoming' })]
      })
    })
    const client = createClient(fetcher)

    const videos = await client.listVideoDetails([...ids, 'future-video', 'private-without-details'])

    expect(videoRequestSizes).toEqual([50, 3])
    expect(videos.map((video) => video.id)).toEqual(['video-0', 'video-1', 'video-50'])
    expect(videos[0]).toMatchObject({
      durationIso: 'PT1H2M3S',
      durationSeconds: 3723,
      liveStatus: 'live',
      scheduledStartTime: '2026-09-19T10:00:00.000Z',
      actualStartTime: '2026-09-19T10:05:00.000Z',
      thumbnailUrl: 'https://example.com/video-0.jpg',
      url: 'https://www.youtube.com/watch?v=video-0'
    })
    expect(videos[1]).toMatchObject({
      liveStatus: 'completed',
      actualEndTime: '2026-09-18T11:00:00.000Z'
    })
    expect(videos[2].liveStatus).toBe('upcoming')
  })

  it('rejects an aborted request even when the fetcher resolves late', async () => {
    let resolveResponse: ((response: Response) => void) | undefined
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve
    }))
    const client = createClient(fetcher)
    const controller = new AbortController()

    const result = client.listMySubscriptions({ signal: controller.signal })
    controller.abort()
    resolveResponse?.(jsonResponse({ items: [subscriptionItem('late', 'Late')] }))

    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('returns useful authorization, quota and invalid-response errors', async () => {
    const disconnectedClient = createYouTubeApiClient({
      getAccessToken: () => null,
      fetcher: vi.fn()
    })

    await expect(disconnectedClient.listMySubscriptions()).rejects.toMatchObject({
      name: 'YouTubeApiError',
      kind: 'authorization'
    })

    const quotaClient = createClient(vi.fn(async () => jsonResponse({
      error: {
        message: 'Quota exceeded',
        errors: [{ reason: 'quotaExceeded' }]
      }
    }, 403)))

    await expect(quotaClient.listMySubscriptions()).rejects.toMatchObject({
      name: 'YouTubeApiError',
      kind: 'quota',
      status: 403,
      reason: 'quotaExceeded'
    })

    const invalidClient = createClient(vi.fn(async () => jsonResponse({ pageInfo: {} })))

    await expect(invalidClient.listMySubscriptions()).rejects.toBeInstanceOf(YouTubeApiError)
    await expect(invalidClient.listMySubscriptions()).rejects.toMatchObject({
      kind: 'invalid_response'
    })
  })
})

function createClient(fetcher: typeof fetch) {
  return createYouTubeApiClient({
    getAccessToken: () => 'memory-token',
    fetcher,
    now: () => new Date(now)
  })
}

function subscriptionItem(channelId: string, title: string) {
  return {
    snippet: {
      title,
      resourceId: { channelId },
      thumbnails: {
        high: { url: `https://example.com/${channelId}.jpg` }
      }
    }
  }
}

function channelItem(channelId: string) {
  return {
    id: channelId,
    snippet: { title: channelId },
    contentDetails: {
      relatedPlaylists: { uploads: `uploads-${channelId}` }
    }
  }
}

function uploadItem(id: string, channelId: string, publishedAt: string) {
  return {
    snippet: {
      publishedAt,
      videoOwnerChannelId: channelId,
      resourceId: { videoId: id }
    },
    contentDetails: {
      videoId: id,
      videoPublishedAt: publishedAt
    }
  }
}

function videoItem(
  id: string,
  overrides: {
    publishedAt?: string
    liveBroadcastContent?: string
    liveStreamingDetails?: Record<string, string>
  } = {}
) {
  return {
    id,
    snippet: {
      channelId: 'channel-a',
      title: `Title ${id}`,
      publishedAt: overrides.publishedAt ?? '2026-09-18T08:00:00Z',
      liveBroadcastContent: overrides.liveBroadcastContent ?? 'none',
      thumbnails: {
        high: { url: `https://example.com/${id}.jpg` }
      }
    },
    contentDetails: { duration: 'PT1H2M3S' },
    ...(overrides.liveStreamingDetails
      ? { liveStreamingDetails: overrides.liveStreamingDetails }
      : {})
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
