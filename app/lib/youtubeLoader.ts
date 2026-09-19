import type { YouTubeSnapshotLoader } from './youtubeSync'
import type { YouTubeClient } from './youtubeTypes'
import { WATCHLOAD_WINDOWS } from './watchload'

const LOAD_CONCURRENCY = 4

export interface YouTubeLoaderOptions {
  getClient: () => YouTubeClient
  now?: () => Date
}

export async function loadYouTubeAccountId(
  client: YouTubeClient,
  signal?: AbortSignal
): Promise<string> {
  return client.getMyChannelId({ signal })
}

export function createYouTubeSnapshotLoader(
  options: YouTubeLoaderOptions
): YouTubeSnapshotLoader {
  const now = options.now ?? (() => new Date())

  return async ({ previous, signal, channelIds }) => {
    const client = options.getClient()
    const subscriptions = channelIds
      ? previous?.subscriptions ?? []
      : await client.listMySubscriptions({ signal })
    const requestedChannelIds = channelIds ?? subscriptions.map((channel) => channel.id)
    const publishedAfter = new Date(
      now().getTime() - WATCHLOAD_WINDOWS.month * 1000
    ).toISOString()
    const channels = await mapWithConcurrency(
      requestedChannelIds,
      LOAD_CONCURRENCY,
      async (channelId) => {
        try {
          const uploads = await client.listRecentUploads([channelId], publishedAfter, { signal })
          const videos = uploads.length > 0
            ? await client.listVideoDetails(uploads.map((video) => video.id), { signal })
            : []

          return {
            channelId,
            videos: videos.filter((video) => video.channelId === channelId)
          }
        } catch (error) {
          if (signal.aborted) {
            throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
          }

          return { channelId, error }
        }
      }
    )

    return {
      ...(!channelIds ? { subscriptions } : {}),
      channels
    }
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  map: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await map(values[index]!)
    }
  }

  const workerCount = Math.min(concurrency, values.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}
