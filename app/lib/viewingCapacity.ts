import { APP_STORAGE_PREFIX, type LocalStorageLike } from './contentPreferences'

export const DAILY_CAPACITY_STORAGE_VERSION = 1
export const MAX_DAILY_CAPACITY_MINUTES = Math.floor(Number.MAX_SAFE_INTEGER / 60)

const DAILY_CAPACITY_KEY_PREFIX = `${APP_STORAGE_PREFIX}daily-capacity:`

export type DailyCapacityStatus = 'sufficient' | 'tight' | 'deficit'

export interface DailyCapacityComparison {
  capacityMinutes: number
  capacitySeconds: number
  requiredDailySeconds: number
  differenceSeconds: number
  coveragePercent: number
  status: DailyCapacityStatus
}

interface StoredDailyCapacity {
  version: typeof DAILY_CAPACITY_STORAGE_VERSION
  accountId: string
  minutes: number
}

export function normalizeDailyCapacityMinutes(value: unknown): number {
  if (value === '' || value === null || value === undefined) {
    return 0
  }

  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0
  }

  return Math.min(Math.floor(numericValue), MAX_DAILY_CAPACITY_MINUTES)
}

export function compareDailyCapacity(
  requiredDailySeconds: number,
  capacityMinutes: number
): DailyCapacityComparison {
  const safeRequiredSeconds = normalizeSeconds(requiredDailySeconds)
  const safeCapacityMinutes = normalizeDailyCapacityMinutes(capacityMinutes)
  const capacitySeconds = safeCapacityMinutes * 60
  const differenceSeconds = capacitySeconds - safeRequiredSeconds
  const rawCoveragePercent = safeRequiredSeconds === 0
    ? 100
    : (capacitySeconds / safeRequiredSeconds) * 100
  const coveragePercent = Number.isFinite(rawCoveragePercent)
    ? rawCoveragePercent
    : Number.MAX_SAFE_INTEGER

  return {
    capacityMinutes: safeCapacityMinutes,
    capacitySeconds,
    requiredDailySeconds: safeRequiredSeconds,
    differenceSeconds,
    coveragePercent,
    status: differenceSeconds > 0
      ? 'sufficient'
      : differenceSeconds < 0
        ? 'deficit'
        : 'tight'
  }
}

export function dailyCapacityStorageKey(accountId: string): string {
  assertAccountId(accountId)
  return `${DAILY_CAPACITY_KEY_PREFIX}${encodeURIComponent(accountId)}`
}

export function loadDailyCapacityMinutes(
  accountId: string,
  storage: LocalStorageLike | null = getBrowserLocalStorage()
): number {
  assertAccountId(accountId)

  if (!storage) {
    return 0
  }

  try {
    const serialized = storage.getItem(dailyCapacityStorageKey(accountId))

    if (!serialized) {
      return 0
    }

    const parsed: unknown = JSON.parse(serialized)

    if (
      !isRecord(parsed) ||
      parsed.version !== DAILY_CAPACITY_STORAGE_VERSION ||
      parsed.accountId !== accountId ||
      typeof parsed.minutes !== 'number' ||
      !Number.isInteger(parsed.minutes) ||
      parsed.minutes < 0 ||
      parsed.minutes > MAX_DAILY_CAPACITY_MINUTES
    ) {
      return 0
    }

    return parsed.minutes
  } catch {
    return 0
  }
}

export function saveDailyCapacityMinutes(
  accountId: string,
  minutes: number,
  storage: LocalStorageLike | null = getBrowserLocalStorage()
): boolean {
  assertAccountId(accountId)

  if (!storage) {
    return false
  }

  const stored: StoredDailyCapacity = {
    version: DAILY_CAPACITY_STORAGE_VERSION,
    accountId,
    minutes: normalizeDailyCapacityMinutes(minutes)
  }

  try {
    storage.setItem(dailyCapacityStorageKey(accountId), JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}

export function clearDailyCapacityMinutes(
  accountId: string,
  storage: LocalStorageLike | null = getBrowserLocalStorage()
): boolean {
  const key = dailyCapacityStorageKey(accountId)

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

function normalizeSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  return Math.min(value, Number.MAX_SAFE_INTEGER)
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

function assertAccountId(accountId: string): void {
  if (accountId.trim().length === 0) {
    throw new TypeError('accountId must not be empty')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
