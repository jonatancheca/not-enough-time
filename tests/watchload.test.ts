import { describe, expect, it } from 'vitest'
import {
  buildWatchloadSummary,
  getVideoWindow,
  parseYouTubeDurationToSeconds
} from '../app/lib/watchload'
import type { PublishedVideo, SubscribedChannel } from '../app/lib/youtubeTypes'

const now = new Date('2026-06-14T12:00:00.000Z')

const channels: SubscribedChannel[] = [
  {
    id: 'alpha',
    title: 'Alpha',
    avatarUrl: 'https://example.com/alpha.jpg',
    url: 'https://example.com/alpha'
  },
  {
    id: 'beta',
    title: 'Beta',
    avatarUrl: 'https://example.com/beta.jpg',
    url: 'https://example.com/beta'
  }
]

describe('watchload calculations', () => {
  it('parses YouTube ISO 8601 durations to seconds', () => {
    expect(parseYouTubeDurationToSeconds('PT15M33S')).toBe(933)
    expect(parseYouTubeDurationToSeconds('PT1H02M03S')).toBe(3723)
    expect(parseYouTubeDurationToSeconds('P1DT2H')).toBe(93600)
    expect(parseYouTubeDurationToSeconds('PT0S')).toBe(0)
  })

  it('classifies videos into moving windows with a fixed clock', () => {
    expect(getVideoWindow(isoHoursAgo(2), now)).toBe('day')
    expect(getVideoWindow(isoDaysAgo(3), now)).toBe('week')
    expect(getVideoWindow(isoDaysAgo(12), now)).toBe('month')
    expect(getVideoWindow(isoDaysAgo(31), now)).toBe('older')
  })

  it('calculates daily, weekly, monthly and required daily seconds', () => {
    const summary = buildWatchloadSummary(channels, [
      video('day', 'alpha', isoHoursAgo(2), 1800),
      video('week', 'alpha', isoDaysAgo(3), 3600),
      video('month', 'beta', isoDaysAgo(12), 7200),
      video('older', 'beta', isoDaysAgo(31), 18000),
      video('future', 'beta', isoHoursAgo(-1), 600)
    ], now)

    expect(summary.daySeconds).toBe(1800)
    expect(summary.weekSeconds).toBe(5400)
    expect(summary.monthSeconds).toBe(12600)
    expect(summary.requiredDailySeconds).toBe(420)
    expect(summary.videoCount).toBe(3)
  })

  it('aggregates month watchload by subscribed channel', () => {
    const summary = buildWatchloadSummary(channels, [
      video('alpha-1', 'alpha', isoHoursAgo(2), 1800),
      video('alpha-2', 'alpha', isoDaysAgo(3), 3600),
      video('beta-1', 'beta', isoDaysAgo(12), 7200)
    ], now)

    expect(summary.channelBreakdown).toHaveLength(2)
    expect(summary.channelBreakdown[0].channel.id).toBe('beta')
    expect(summary.channelBreakdown[0].monthSeconds).toBe(7200)
    expect(summary.channelBreakdown[0].shareOfMonth).toBeCloseTo(7200 / 12600)
    expect(summary.channelBreakdown[1].channel.id).toBe('alpha')
    expect(summary.channelBreakdown[1].daySeconds).toBe(1800)
    expect(summary.channelBreakdown[1].weekSeconds).toBe(5400)
  })
})

function video(id: string, channelId: string, publishedAt: string, durationSeconds: number): PublishedVideo {
  return {
    id,
    channelId,
    title: id,
    publishedAt,
    durationIso: 'PT1M',
    durationSeconds,
    thumbnailUrl: 'https://example.com/thumb.jpg',
    url: `https://example.com/${id}`
  }
}

function isoHoursAgo(hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString()
}

function isoDaysAgo(days: number): string {
  return isoHoursAgo(days * 24)
}
