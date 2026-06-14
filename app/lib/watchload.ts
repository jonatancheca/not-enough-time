import type { ChannelBreakdown, PublishedVideo, SubscribedChannel, WatchloadSummary } from './youtubeTypes'

const SECOND = 1000
const DAY_SECONDS = 24 * 60 * 60

export const WATCHLOAD_WINDOWS = {
  day: DAY_SECONDS,
  week: 7 * DAY_SECONDS,
  month: 30 * DAY_SECONDS
} as const

export type WatchloadWindow = keyof typeof WATCHLOAD_WINDOWS

export function parseYouTubeDurationToSeconds(durationIso: string): number {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(durationIso)

  if (!match) {
    throw new Error(`Invalid YouTube duration: ${durationIso}`)
  }

  const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match
  const hasAnyComponent = [days, hours, minutes, seconds].some((value) => Number(value) > 0)

  if (!hasAnyComponent) {
    return 0
  }

  return (
    Number(days) * DAY_SECONDS +
    Number(hours) * 60 * 60 +
    Number(minutes) * 60 +
    Number(seconds)
  )
}

export function isWithinWindow(publishedAt: string, now: Date, windowSeconds: number): boolean {
  const publishedTime = new Date(publishedAt).getTime()
  const nowTime = now.getTime()
  const oldestAllowed = nowTime - windowSeconds * SECOND

  return publishedTime <= nowTime && publishedTime >= oldestAllowed
}

export function getVideoWindow(publishedAt: string, now: Date): WatchloadWindow | 'older' {
  if (isWithinWindow(publishedAt, now, WATCHLOAD_WINDOWS.day)) {
    return 'day'
  }

  if (isWithinWindow(publishedAt, now, WATCHLOAD_WINDOWS.week)) {
    return 'week'
  }

  if (isWithinWindow(publishedAt, now, WATCHLOAD_WINDOWS.month)) {
    return 'month'
  }

  return 'older'
}

export function buildWatchloadSummary(
  channels: SubscribedChannel[],
  videos: PublishedVideo[],
  now: Date = new Date()
): WatchloadSummary {
  const dayVideos = filterWindow(videos, now, WATCHLOAD_WINDOWS.day)
  const weekVideos = filterWindow(videos, now, WATCHLOAD_WINDOWS.week)
  const monthVideos = filterWindow(videos, now, WATCHLOAD_WINDOWS.month)

  const monthSeconds = sumSeconds(monthVideos)
  const channelBreakdown = buildChannelBreakdown(channels, monthVideos, now, monthSeconds)

  return {
    daySeconds: sumSeconds(dayVideos),
    weekSeconds: sumSeconds(weekVideos),
    monthSeconds,
    requiredDailySeconds: monthSeconds / 30,
    videoCount: monthVideos.length,
    channelBreakdown
  }
}

export function secondsToHours(seconds: number): number {
  return seconds / 60 / 60
}

export function formatDuration(seconds: number): string {
  const roundedSeconds = Math.round(seconds)
  const hours = Math.floor(roundedSeconds / 3600)
  const minutes = Math.floor((roundedSeconds % 3600) / 60)

  if (hours === 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours} h`
  }

  return `${hours} h ${minutes} min`
}

export function formatHours(seconds: number, digits = 1): string {
  return `${secondsToHours(seconds).toLocaleString('es-ES', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  })} h`
}

function filterWindow(videos: PublishedVideo[], now: Date, windowSeconds: number): PublishedVideo[] {
  return videos.filter((video) => isWithinWindow(video.publishedAt, now, windowSeconds))
}

function sumSeconds(videos: PublishedVideo[]): number {
  return videos.reduce((total, video) => total + video.durationSeconds, 0)
}

function buildChannelBreakdown(
  channels: SubscribedChannel[],
  monthVideos: PublishedVideo[],
  now: Date,
  monthSeconds: number
): ChannelBreakdown[] {
  return channels
    .map((channel) => {
      const channelVideos = monthVideos.filter((video) => video.channelId === channel.id)
      const latestVideo = channelVideos.toSorted(
        (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
      )[0]

      const channelMonthSeconds = sumSeconds(channelVideos)

      return {
        channel,
        daySeconds: sumSeconds(filterWindow(channelVideos, now, WATCHLOAD_WINDOWS.day)),
        weekSeconds: sumSeconds(filterWindow(channelVideos, now, WATCHLOAD_WINDOWS.week)),
        monthSeconds: channelMonthSeconds,
        videoCount: channelVideos.length,
        shareOfMonth: monthSeconds === 0 ? 0 : channelMonthSeconds / monthSeconds,
        latestVideo
      }
    })
    .filter((entry) => entry.videoCount > 0)
    .sort((left, right) => right.monthSeconds - left.monthSeconds)
}
