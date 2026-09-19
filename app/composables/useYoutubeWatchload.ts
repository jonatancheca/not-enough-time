import { createMockYouTubeClient } from '~/lib/youtubeMock'
import { loadContentPreferences } from '~/lib/contentPreferences'
import { buildEligibleWatchload, WATCHLOAD_WINDOWS } from '~/lib/watchload'

export const MOCK_YOUTUBE_ACCOUNT_ID = 'mock-youtube-account'

export function useYoutubeWatchload(accountId = MOCK_YOUTUBE_ACCOUNT_ID) {
  return useAsyncData(
    `youtube-api:watchload:${accountId}`,
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
      const preferences = loadContentPreferences(accountId)
      const eligibleWatchload = buildEligibleWatchload(subscriptions, sortedVideos, preferences, now)

      return {
        accountId,
        generatedAt: now.toISOString(),
        subscriptions,
        videos: eligibleWatchload.videos,
        summary: eligibleWatchload.summary
      }
    },
    {
      server: false
    }
  )
}
