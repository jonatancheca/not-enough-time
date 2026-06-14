import { createMockYouTubeClient } from '~/lib/youtubeMock'
import { buildWatchloadSummary, WATCHLOAD_WINDOWS } from '~/lib/watchload'

export function useYoutubeWatchload() {
  return useAsyncData(
    'youtube-watchload',
    async () => {
      const now = new Date()
      const client = createMockYouTubeClient(now)
      const subscriptions = await client.listMySubscriptions()
      const channelIds = subscriptions.map((channel) => channel.id)
      const publishedAfter = new Date(now.getTime() - WATCHLOAD_WINDOWS.month * 1000).toISOString()
      const uploads = await client.listRecentUploads(channelIds, publishedAfter)
      const videos = await client.listVideoDetails(uploads.map((video) => video.id))
      const sortedVideos = videos.toSorted(
        (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
      )

      return {
        generatedAt: now.toISOString(),
        subscriptions,
        videos: sortedVideos,
        summary: buildWatchloadSummary(subscriptions, sortedVideos, now)
      }
    },
    {
      server: false
    }
  )
}
