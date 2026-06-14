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
}

export interface YouTubeClient {
  listMySubscriptions(): Promise<SubscribedChannel[]>
  listRecentUploads(channelIds: string[], publishedAfter: string): Promise<PublishedVideo[]>
  listVideoDetails(videoIds: string[]): Promise<PublishedVideo[]>
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
