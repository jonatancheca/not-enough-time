import type { PublishedVideo } from './youtubeTypes'

export const SHORT_VIDEO_LIMIT_SECONDS = 5 * 60

export type VideoContentCategory = 'short' | 'long' | 'live'

export interface ExcludedContentCategories {
  short: boolean
  long: boolean
  live: boolean
}

export interface ChannelContentRule {
  excluded: boolean
  excludedCategories: ExcludedContentCategories
}

export interface AccountContentPreferences {
  accountId: string
  channelRules: Record<string, ChannelContentRule>
}

export function createContentPreferences(accountId: string): AccountContentPreferences {
  assertIdentifier(accountId, 'accountId')

  return {
    accountId,
    channelRules: {}
  }
}

export function createChannelContentRule(): ChannelContentRule {
  return {
    excluded: false,
    excludedCategories: {
      short: false,
      long: false,
      live: false
    }
  }
}

export function getChannelContentRule(
  preferences: AccountContentPreferences,
  channelId: string
): ChannelContentRule {
  assertIdentifier(channelId, 'channelId')
  return cloneRule(preferences.channelRules[channelId] ?? createChannelContentRule())
}

export function setChannelExcluded(
  preferences: AccountContentPreferences,
  channelId: string,
  excluded: boolean
): AccountContentPreferences {
  const currentRule = getChannelContentRule(preferences, channelId)

  return withChannelRule(preferences, channelId, {
    ...currentRule,
    excluded
  })
}

export function setContentCategoryExcluded(
  preferences: AccountContentPreferences,
  channelId: string,
  category: VideoContentCategory,
  excluded: boolean
): AccountContentPreferences {
  const currentRule = getChannelContentRule(preferences, channelId)

  return withChannelRule(preferences, channelId, {
    ...currentRule,
    excludedCategories: {
      ...currentRule.excludedCategories,
      [category]: excluded
    }
  })
}

export function classifyVideoContent(
  video: Pick<PublishedVideo, 'durationSeconds' | 'liveStatus'>
): VideoContentCategory {
  if (video.liveStatus !== 'none') {
    return 'live'
  }

  return video.durationSeconds < SHORT_VIDEO_LIMIT_SECONDS ? 'short' : 'long'
}

export function isVideoEligible(
  video: PublishedVideo,
  preferences: AccountContentPreferences
): boolean {
  const rule = preferences.channelRules[video.channelId]

  if (!rule) {
    return true
  }

  return !rule.excluded && !rule.excludedCategories[classifyVideoContent(video)]
}

export function filterEligibleVideos<T extends PublishedVideo>(
  videos: readonly T[],
  preferences: AccountContentPreferences
): T[] {
  return videos.filter((video) => isVideoEligible(video, preferences))
}

function withChannelRule(
  preferences: AccountContentPreferences,
  channelId: string,
  rule: ChannelContentRule
): AccountContentPreferences {
  return {
    ...preferences,
    channelRules: {
      ...preferences.channelRules,
      [channelId]: cloneRule(rule)
    }
  }
}

function cloneRule(rule: ChannelContentRule): ChannelContentRule {
  return {
    excluded: rule.excluded,
    excludedCategories: { ...rule.excludedCategories }
  }
}

function assertIdentifier(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${name} must not be empty`)
  }
}
