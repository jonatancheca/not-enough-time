import { describe, expect, it } from 'vitest'
import type { LocalStorageLike } from '../app/lib/contentPreferences'
import {
  clearDailyCapacityMinutes,
  compareDailyCapacity,
  dailyCapacityStorageKey,
  loadDailyCapacityMinutes,
  normalizeDailyCapacityMinutes,
  saveDailyCapacityMinutes
} from '../app/lib/viewingCapacity'

describe('daily viewing capacity', () => {
  it('uses real values for sufficient, tight and deficit states', () => {
    expect(compareDailyCapacity(3599, 60)).toMatchObject({
      differenceSeconds: 1,
      coveragePercent: (3600 / 3599) * 100,
      status: 'sufficient'
    })
    expect(compareDailyCapacity(3600, 60)).toMatchObject({
      differenceSeconds: 0,
      coveragePercent: 100,
      status: 'tight'
    })
    expect(compareDailyCapacity(3601, 60)).toMatchObject({
      differenceSeconds: -1,
      coveragePercent: (3600 / 3601) * 100,
      status: 'deficit'
    })
  })

  it('defines zero publication pace without NaN or infinity', () => {
    expect(compareDailyCapacity(0, 0)).toEqual({
      capacityMinutes: 0,
      capacitySeconds: 0,
      requiredDailySeconds: 0,
      differenceSeconds: 0,
      coveragePercent: 100,
      status: 'tight'
    })
    expect(compareDailyCapacity(0, 30)).toMatchObject({
      differenceSeconds: 1800,
      coveragePercent: 100,
      status: 'sufficient'
    })
    expect(compareDailyCapacity(60, 0)).toMatchObject({
      differenceSeconds: -60,
      coveragePercent: 0,
      status: 'deficit'
    })
  })

  it('normalizes partial or invalid numeric data to finite non-negative values', () => {
    expect(normalizeDailyCapacityMinutes('12.9')).toBe(12)
    expect(normalizeDailyCapacityMinutes(-5)).toBe(0)
    expect(normalizeDailyCapacityMinutes(Number.NaN)).toBe(0)
    expect(normalizeDailyCapacityMinutes(Number.POSITIVE_INFINITY)).toBe(0)

    for (const requiredSeconds of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const comparison = compareDailyCapacity(requiredSeconds, 15)
      expect(Object.values(comparison).filter((value) => typeof value === 'number').every(Number.isFinite)).toBe(true)
    }
  })
})

describe('daily viewing capacity persistence', () => {
  it('stores integer minutes independently by account', () => {
    const storage = new MemoryStorage()

    expect(saveDailyCapacityMinutes('account-a', 45, storage)).toBe(true)
    expect(saveDailyCapacityMinutes('account-b', 90, storage)).toBe(true)
    expect(loadDailyCapacityMinutes('account-a', storage)).toBe(45)
    expect(loadDailyCapacityMinutes('account-b', storage)).toBe(90)
    expect(loadDailyCapacityMinutes('account-c', storage)).toBe(0)
  })

  it('falls back safely for corrupt, unsupported and mismatched values', () => {
    const storage = new MemoryStorage()
    const key = dailyCapacityStorageKey('account-a')

    storage.setItem(key, '{broken')
    expect(loadDailyCapacityMinutes('account-a', storage)).toBe(0)

    storage.setItem(key, JSON.stringify({ version: 2, accountId: 'account-a', minutes: 30 }))
    expect(loadDailyCapacityMinutes('account-a', storage)).toBe(0)

    storage.setItem(key, JSON.stringify({ version: 1, accountId: 'account-b', minutes: 30 }))
    expect(loadDailyCapacityMinutes('account-a', storage)).toBe(0)

    storage.setItem(key, JSON.stringify({ version: 1, accountId: 'account-a', minutes: 1.5 }))
    expect(loadDailyCapacityMinutes('account-a', storage)).toBe(0)
  })

  it('works safely without storage and when storage throws', () => {
    const storage = new ThrowingStorage()

    expect(loadDailyCapacityMinutes('account-a', null)).toBe(0)
    expect(saveDailyCapacityMinutes('account-a', 30, null)).toBe(false)
    expect(loadDailyCapacityMinutes('account-a', storage)).toBe(0)
    expect(saveDailyCapacityMinutes('account-a', 30, storage)).toBe(false)
    expect(clearDailyCapacityMinutes('account-a', null)).toBe(false)
    expect(clearDailyCapacityMinutes('account-a', storage)).toBe(false)
  })

  it('deletes only capacity linked to the revoked account', () => {
    const storage = new MemoryStorage()
    saveDailyCapacityMinutes('account-a', 30, storage)
    saveDailyCapacityMinutes('account-b', 60, storage)

    expect(clearDailyCapacityMinutes('account-a', storage)).toBe(true)
    expect(loadDailyCapacityMinutes('account-a', storage)).toBe(0)
    expect(loadDailyCapacityMinutes('account-b', storage)).toBe(60)
  })
})

class MemoryStorage implements LocalStorageLike {
  readonly values = new Map<string, string>()

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
