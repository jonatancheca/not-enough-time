export interface SubscribedChannel {
  id: string
  title: string
  avatarUrl: string
  url: string
}

export interface PublishedVideo {
  id: string
  channelId: string
  title: string
  publishedAt: string
  durationIso: string
  durationSeconds: number
  thumbnailUrl: string
  url: string
  liveStatus: YouTubeLiveStatus
  scheduledStartTime?: string
  actualStartTime?: string
  actualEndTime?: string
}

export type YouTubeLiveStatus = 'none' | 'upcoming' | 'live' | 'completed'

export interface YouTubeUploadReference {
  id: string
  channelId: string
  publishedAt: string
}

export interface YouTubeRequestOptions {
  signal?: AbortSignal
}

export interface YouTubeClient {
  listMySubscriptions(options?: YouTubeRequestOptions): Promise<SubscribedChannel[]>
  listRecentUploads(
    channelIds: string[],
    publishedAfter: string,
    options?: YouTubeRequestOptions
  ): Promise<YouTubeUploadReference[]>
  listVideoDetails(videoIds: string[], options?: YouTubeRequestOptions): Promise<PublishedVideo[]>
}

export interface ChannelBreakdown {
  channel: SubscribedChannel
  daySeconds: number
  weekSeconds: number
  monthSeconds: number
  videoCount: number
  shareOfMonth: number
  latestVideo?: PublishedVideo
}

export interface WatchloadSummary {
  daySeconds: number
  weekSeconds: number
  monthSeconds: number
  requiredDailySeconds: number
  videoCount: number
  channelBreakdown: ChannelBreakdown[]
}
