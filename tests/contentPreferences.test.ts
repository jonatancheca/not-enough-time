import { describe, expect, it } from 'vitest'
import {
  classifyVideoContent,
  createContentPreferences,
  filterEligibleVideos,
  getChannelContentRule,
  setChannelExcluded,
  setContentCategoryExcluded
} from '../app/lib/contentRules'
import {
  APP_STORAGE_PREFIX,
  clearAllAppLocalData,
  clearContentPreferences,
  contentPreferencesStorageKey,
  loadContentPreferences,
  saveContentPreferences,
  type LocalStorageLike
} from '../app/lib/contentPreferences'
import type { PublishedVideo, YouTubeLiveStatus } from '../app/lib/youtubeTypes'

describe('content rules', () => {
  it('classifies the exact five-minute boundary and keeps live broadcasts exclusive', () => {
    expect(classifyVideoContent(video('short', 'alpha', 299))).toBe('short')
    expect(classifyVideoContent(video('long', 'alpha', 300))).toBe('long')
    expect(classifyVideoContent(video('longer', 'alpha', 301))).toBe('long')
    expect(classifyVideoContent(video('live-short', 'alpha', 10, 'live'))).toBe('live')
    expect(classifyVideoContent(video('live-long', 'alpha', 7200, 'completed'))).toBe('live')
    expect(classifyVideoContent(video('upcoming', 'alpha', 0, 'upcoming'))).toBe('live')
  })

  it('filters whole channels and categories without changing source videos', () => {
    const source = [
      video('alpha-short', 'alpha', 299),
      video('alpha-long', 'alpha', 300),
      video('alpha-live', 'alpha', 120, 'completed'),
      video('beta-long', 'beta', 600)
    ]
    const initial = createContentPreferences('account-a')
    const withoutAlphaShorts = setContentCategoryExcluded(initial, 'alpha', 'short', true)
    const preferences = setChannelExcluded(withoutAlphaShorts, 'beta', true)

    expect(filterEligibleVideos(source, preferences).map(({ id }) => id)).toEqual([
      'alpha-long',
      'alpha-live'
    ])
    expect(source).toHaveLength(4)
    expect(initial.channelRules).toEqual({})
  })

  it('retains category rules while excluding and including a channel', () => {
    const initial = setContentCategoryExcluded(
      createContentPreferences('account-a'),
      'temporarily-missing-channel',
      'live',
      true
    )
    const excluded = setChannelExcluded(initial, 'temporarily-missing-channel', true)
    const included = setChannelExcluded(excluded, 'temporarily-missing-channel', false)

    expect(getChannelContentRule(included, 'temporarily-missing-channel')).toEqual({
      excluded: false,
      excludedCategories: {
        short: false,
        long: false,
        live: true
      }
    })
  })

  it('keeps configuration when every category is excluded', () => {
    const categories = ['short', 'long', 'live'] as const
    const preferences = categories.reduce(
      (current, category) => setContentCategoryExcluded(current, 'alpha', category, true),
      createContentPreferences('account-a')
    )

    expect(filterEligibleVideos([
      video('short', 'alpha', 299),
      video('long', 'alpha', 300),
      video('live', 'alpha', 60, 'live')
    ], preferences)).toEqual([])
    expect(preferences.channelRules.alpha).toBeDefined()
  })
})

describe('content preference persistence', () => {
  it('persists and isolates rules by explicit account ID', () => {
    const storage = new MemoryStorage()
    const accountA = setChannelExcluded(createContentPreferences('channel-account-a'), 'alpha', true)
    const accountB = setContentCategoryExcluded(
      createContentPreferences('channel-account-b'),
      'beta',
      'long',
      true
    )

    expect(saveContentPreferences(accountA, storage)).toBe(true)
    expect(saveContentPreferences(accountB, storage)).toBe(true)

    expect(loadContentPreferences('channel-account-a', storage)).toEqual(accountA)
    expect(loadContentPreferences('channel-account-b', storage)).toEqual(accountB)
    expect(loadContentPreferences('channel-account-c', storage)).toEqual(
      createContentPreferences('channel-account-c')
    )
  })

  it('does not discard rules for channels missing from a later synchronization', () => {
    const storage = new MemoryStorage()
    const preferences = setChannelExcluded(
      createContentPreferences('account-a'),
      'channel-not-in-current-subscriptions',
      true
    )

    saveContentPreferences(preferences, storage)

    expect(loadContentPreferences('account-a', storage).channelRules).toHaveProperty(
      'channel-not-in-current-subscriptions'
    )
  })

  it('falls back safely for corrupt, unsupported or mismatched payloads', () => {
    const storage = new MemoryStorage()
    const key = contentPreferencesStorageKey('account-a')

    storage.setItem(key, '{broken')
    expect(loadContentPreferences('account-a', storage)).toEqual(createContentPreferences('account-a'))

    storage.setItem(key, JSON.stringify({ version: 2, accountId: 'account-a', channelRules: {} }))
    expect(loadContentPreferences('account-a', storage)).toEqual(createContentPreferences('account-a'))

    storage.setItem(key, JSON.stringify({ version: 1, accountId: 'account-b', channelRules: {} }))
    expect(loadContentPreferences('account-a', storage)).toEqual(createContentPreferences('account-a'))
  })

  it('works safely when browser storage is absent or throws', () => {
    const preferences = createContentPreferences('account-a')
    const unavailableStorage = new ThrowingStorage()

    expect(loadContentPreferences('account-a', null)).toEqual(preferences)
    expect(saveContentPreferences(preferences, null)).toBe(false)
    expect(clearAllAppLocalData(null)).toBe(0)
    expect(loadContentPreferences('account-a', unavailableStorage)).toEqual(preferences)
    expect(saveContentPreferences(preferences, unavailableStorage)).toBe(false)
    expect(clearContentPreferences('account-a', null)).toBe(false)
    expect(clearContentPreferences('account-a', unavailableStorage)).toBe(false)
    expect(clearAllAppLocalData(unavailableStorage)).toBe(0)
  })

  it('deletes only preferences linked to the revoked account', () => {
    const storage = new MemoryStorage()
    storage.setItem(contentPreferencesStorageKey('account-a'), '{}')
    storage.setItem(contentPreferencesStorageKey('account-b'), '{}')

    expect(clearContentPreferences('account-a', storage)).toBe(true)
    expect(storage.getItem(contentPreferencesStorageKey('account-a'))).toBeNull()
    expect(storage.getItem(contentPreferencesStorageKey('account-b'))).toBe('{}')
  })

  it('clears only this application namespace without using a global clear', () => {
    const storage = new MemoryStorage()
    storage.setItem(contentPreferencesStorageKey('account-a'), '{}')
    storage.setItem(`${APP_STORAGE_PREFIX}future-cache-key`, 'cached')
    storage.setItem('another-app:preferences', 'keep')

    expect(clearAllAppLocalData(storage)).toBe(2)
    expect(storage.getItem(contentPreferencesStorageKey('account-a'))).toBeNull()
    expect(storage.getItem(`${APP_STORAGE_PREFIX}future-cache-key`)).toBeNull()
    expect(storage.getItem('another-app:preferences')).toBe('keep')
    expect(storage.clearCalls).toBe(0)
  })
})

function video(
  id: string,
  channelId: string,
  durationSeconds: number,
  liveStatus: YouTubeLiveStatus = 'none'
): PublishedVideo {
  return {
    id,
    channelId,
    title: id,
    publishedAt: '2026-09-19T10:00:00.000Z',
    durationIso: 'PT1M',
    durationSeconds,
    thumbnailUrl: `https://example.com/${id}.jpg`,
    url: `https://example.com/${id}`,
    liveStatus
  }
}

class MemoryStorage implements LocalStorageLike {
  readonly values = new Map<string, string>()
  clearCalls = 0

  get length(): number {
    return this.values.size
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  clear(): void {
    this.clearCalls += 1
    this.values.clear()
  }
}

class ThrowingStorage implements LocalStorageLike {
  get length(): number {
    throw new Error('Storage unavailable')
  }

  getItem(): string | null {
    throw new Error('Storage unavailable')
  }

  key(): string | null {
    throw new Error('Storage unavailable')
  }

  removeItem(): void {
    throw new Error('Storage unavailable')
  }

  setItem(): void {
    throw new Error('Storage unavailable')
  }
}
