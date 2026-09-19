import {
  createContentPreferences,
  type AccountContentPreferences,
  type ChannelContentRule
} from './contentRules'

export const APP_STORAGE_PREFIX = 'not-enough-time:'
export const CONTENT_PREFERENCES_STORAGE_VERSION = 1

const CONTENT_PREFERENCES_KEY_PREFIX = `${APP_STORAGE_PREFIX}content-preferences:`

export interface LocalStorageLike {
  readonly length: number
  getItem(key: string): string | null
  key(index: number): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

interface StoredContentPreferences {
  version: typeof CONTENT_PREFERENCES_STORAGE_VERSION
  accountId: string
  channelRules: Record<string, ChannelContentRule>
}

export function contentPreferencesStorageKey(accountId: string): string {
  if (accountId.trim().length === 0) {
    throw new TypeError('accountId must not be empty')
  }

  return `${CONTENT_PREFERENCES_KEY_PREFIX}${encodeURIComponent(accountId)}`
}

export function loadContentPreferences(
  accountId: string,
  storage: LocalStorageLike | null = getBrowserLocalStorage()
): AccountContentPreferences {
  const fallback = createContentPreferences(accountId)

  if (!storage) {
    return fallback
  }

  try {
    const serialized = storage.getItem(contentPreferencesStorageKey(accountId))

    if (!serialized) {
      return fallback
    }

    const parsed: unknown = JSON.parse(serialized)
    const stored = parseStoredContentPreferences(parsed, accountId)

    if (!stored) {
      return fallback
    }

    return {
      accountId: stored.accountId,
      channelRules: stored.channelRules
    }
  } catch {
    return fallback
  }
}

export function saveContentPreferences(
  preferences: AccountContentPreferences,
  storage: LocalStorageLike | null = getBrowserLocalStorage()
): boolean {
  if (!storage) {
    return false
  }

  const stored: StoredContentPreferences = {
    version: CONTENT_PREFERENCES_STORAGE_VERSION,
    accountId: preferences.accountId,
    channelRules: cloneChannelRules(preferences.channelRules)
  }

  try {
    storage.setItem(
      contentPreferencesStorageKey(preferences.accountId),
      JSON.stringify(stored)
    )
    return true
  } catch {
    return false
  }
}

export function clearContentPreferences(
  accountId: string,
  storage: LocalStorageLike | null = getBrowserLocalStorage()
): boolean {
  const key = contentPreferencesStorageKey(accountId)

  if (!storage) {
    return false
  }

  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function clearAllAppLocalData(
  storage: LocalStorageLike | null = getBrowserLocalStorage()
): number {
  if (!storage) {
    return 0
  }

  try {
    const appKeys: string[] = []

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)

      if (key?.startsWith(APP_STORAGE_PREFIX)) {
        appKeys.push(key)
      }
    }

    for (const key of appKeys) {
      storage.removeItem(key)
    }

    return appKeys.length
  } catch {
    return 0
  }
}

function getBrowserLocalStorage(): LocalStorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function parseStoredContentPreferences(
  value: unknown,
  expectedAccountId: string
): StoredContentPreferences | null {
  if (
    !isRecord(value) ||
    value.version !== CONTENT_PREFERENCES_STORAGE_VERSION ||
    value.accountId !== expectedAccountId ||
    !isRecord(value.channelRules)
  ) {
    return null
  }

  const channelRuleEntries: Array<[string, ChannelContentRule]> = []

  for (const [channelId, rule] of Object.entries(value.channelRules)) {
    if (channelId.trim().length === 0 || !isChannelContentRule(rule)) {
      return null
    }

    channelRuleEntries.push([
      channelId,
      {
        excluded: rule.excluded,
        excludedCategories: {
          short: rule.excludedCategories.short,
          long: rule.excludedCategories.long,
          live: rule.excludedCategories.live
        }
      }
    ])
  }

  return {
    version: CONTENT_PREFERENCES_STORAGE_VERSION,
    accountId: value.accountId,
    channelRules: Object.fromEntries(channelRuleEntries)
  }
}

function cloneChannelRules(
  channelRules: Record<string, ChannelContentRule>
): Record<string, ChannelContentRule> {
  return Object.fromEntries(
    Object.entries(channelRules).map(([channelId, rule]) => [
      channelId,
      {
        excluded: rule.excluded,
        excludedCategories: { ...rule.excludedCategories }
      }
    ])
  )
}

function isChannelContentRule(value: unknown): value is ChannelContentRule {
  if (!isRecord(value) || typeof value.excluded !== 'boolean' || !isRecord(value.excludedCategories)) {
    return false
  }

  return (
    typeof value.excludedCategories.short === 'boolean' &&
    typeof value.excludedCategories.long === 'boolean' &&
    typeof value.excludedCategories.live === 'boolean'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
