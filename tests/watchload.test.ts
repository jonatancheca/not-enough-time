import { describe, expect, it } from 'vitest'
import {
  buildEligibleWatchload,
  buildWatchloadSummary,
  getVideoWindow,
  parseYouTubeDurationToSeconds
} from '../app/lib/watchload'
import {
  createContentPreferences,
  setChannelExcluded,
  setContentCategoryExcluded
} from '../app/lib/contentRules'
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

  it('includes exact moving-window boundaries and excludes one millisecond beyond them', () => {
    expect(getVideoWindow(isoMillisecondsAgo(24 * 60 * 60 * 1000), now)).toBe('day')
    expect(getVideoWindow(isoMillisecondsAgo(24 * 60 * 60 * 1000 + 1), now)).toBe('week')
    expect(getVideoWindow(isoMillisecondsAgo(7 * 24 * 60 * 60 * 1000), now)).toBe('week')
    expect(getVideoWindow(isoMillisecondsAgo(7 * 24 * 60 * 60 * 1000 + 1), now)).toBe('month')
    expect(getVideoWindow(isoMillisecondsAgo(30 * 24 * 60 * 60 * 1000), now)).toBe('month')
    expect(getVideoWindow(isoMillisecondsAgo(30 * 24 * 60 * 60 * 1000 + 1), now)).toBe('older')
    expect(getVideoWindow(isoMillisecondsAgo(-1), now)).toBe('older')
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

  it('filters channels and exact duration categories before every calculation and listing', () => {
    const basePreferences = setContentCategoryExcluded(
      createContentPreferences('account-a'),
      'alpha',
      'long',
      true
    )
    const preferences = setChannelExcluded(basePreferences, 'beta', true)
    const result = buildEligibleWatchload(channels, [
      video('short-299', 'alpha', isoHoursAgo(1), 299),
      video('long-300', 'alpha', isoHoursAgo(1), 300),
      video('live-300', 'alpha', isoHoursAgo(1), 300, 'completed'),
      video('excluded-channel', 'beta', isoHoursAgo(1), 900)
    ], preferences, now)

    expect(result.videos.map(({ id }) => id)).toEqual(['short-299', 'live-300'])
    expect(result.summary.daySeconds).toBe(599)
    expect(result.summary.weekSeconds).toBe(599)
    expect(result.summary.monthSeconds).toBe(599)
    expect(result.summary.videoCount).toBe(2)
    expect(result.summary.channelBreakdown.map(({ channel }) => channel.id)).toEqual(['alpha'])
  })

  it('keeps partial numeric data finite', () => {
    const summary = buildWatchloadSummary(channels, [
      video('valid', 'alpha', isoHoursAgo(1), 60),
      video('nan', 'alpha', isoHoursAgo(1), Number.NaN),
      video('infinite', 'beta', isoHoursAgo(1), Number.POSITIVE_INFINITY),
      video('negative', 'beta', isoHoursAgo(1), -10)
    ], now)

    expect(summary.daySeconds).toBe(60)
    expect(summary.weekSeconds).toBe(60)
    expect(summary.monthSeconds).toBe(60)
    expect(summary.requiredDailySeconds).toBe(2)
    expect(summary.channelBreakdown.every((entry) => Number.isFinite(entry.shareOfMonth))).toBe(true)
  })
})

function video(
  id: string,
  channelId: string,
  publishedAt: string,
  durationSeconds: number,
  liveStatus: PublishedVideo['liveStatus'] = 'none'
): PublishedVideo {
  return {
    id,
    channelId,
    title: id,
    publishedAt,
    durationIso: 'PT1M',
    durationSeconds,
    thumbnailUrl: 'https://example.com/thumb.jpg',
    url: `https://example.com/${id}`,
    liveStatus
  }
}

function isoHoursAgo(hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString()
}

function isoDaysAgo(days: number): string {
  return isoHoursAgo(days * 24)
}

function isoMillisecondsAgo(milliseconds: number): string {
  return new Date(now.getTime() - milliseconds).toISOString()
}
