import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import {
  clearAllAppLocalData,
  loadContentPreferences,
  saveContentPreferences
} from '~/lib/contentPreferences'
import {
  createChannelContentRule,
  createContentPreferences,
  getChannelContentRule,
  setChannelExcluded,
  setContentCategoryExcluded,
  type AccountContentPreferences,
  type ChannelContentRule,
  type VideoContentCategory
} from '~/lib/contentRules'
import { createYouTubeApiClient } from '~/lib/youtubeApi'
import { createIndexedDbYouTubeCache } from '~/lib/youtubeCache'
import { createYouTubeSnapshotLoader, loadYouTubeAccountId } from '~/lib/youtubeLoader'
import { createMockYouTubeClient } from '~/lib/youtubeMock'
import {
  createYouTubeSyncManager,
  normalizeYouTubeSyncError,
  type YouTubeSyncError,
  type YouTubeSyncManager,
  type YouTubeSyncState
} from '~/lib/youtubeSync'
import { buildEligibleWatchload } from '~/lib/watchload'

export const MOCK_YOUTUBE_ACCOUNT_ID = 'mock-youtube-account'

export interface YouTubeWatchloadData {
  accountId: string
  generatedAt: string
  subscriptions: NonNullable<YouTubeSyncState['snapshot']>['subscriptions']
  videos: NonNullable<YouTubeSyncState['snapshot']>['videos']
  rawVideoCount: number
  summary: ReturnType<typeof buildEligibleWatchload>['summary']
}

export function useYoutubeWatchload() {
  const config = useRuntimeConfig()
  const auth = useYoutubeAuth()
  const mockMode = import.meta.dev && isExplicitTrue(config.public.useYoutubeMock)
  const accountId = ref<string | null>(null)
  const syncState = ref<YouTubeSyncState | null>(null)
  const identityLoading = ref(false)
  const identityError = ref<YouTubeSyncError | null>(null)
  const preferences = ref<AccountContentPreferences | null>(null)
  const cache = import.meta.client ? createIndexedDbYouTubeCache() : null
  let syncManager: YouTubeSyncManager | null = null
  let unsubscribeSync: (() => void) | null = null
  let stopAuthWatch: (() => void) | null = null
  let sessionVersion = 0

  const client = () => mockMode
    ? createMockYouTubeClient(new Date())
    : createYouTubeApiClient({ getAccessToken: auth.getAccessToken })

  const data = computed<YouTubeWatchloadData | null>(() => {
    const snapshot = syncState.value?.snapshot
    const currentPreferences = preferences.value

    if (!snapshot || !currentPreferences) {
      return null
    }

    const eligible = buildEligibleWatchload(
      snapshot.subscriptions,
      snapshot.videos,
      currentPreferences,
      new Date()
    )

    return {
      accountId: snapshot.accountId,
      generatedAt: snapshot.updatedAt,
      subscriptions: snapshot.subscriptions,
      videos: eligible.videos.toSorted(
        (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
      ),
      rawVideoCount: snapshot.videos.length,
      summary: eligible.summary
    }
  })

  const error = computed(() => identityError.value ?? syncState.value?.error ?? null)
  const refreshing = computed(() => syncState.value?.refreshing ?? false)
  const failedChannelIds = computed(() => syncState.value?.snapshot?.failedChannelIds ?? [])

  function ensureSyncManager(): YouTubeSyncManager {
    if (!cache) {
      throw new Error('La sincronización de YouTube requiere un navegador.')
    }

    syncManager ??= createYouTubeSyncManager({
      store: cache,
      load: createYouTubeSnapshotLoader({ getClient: client })
    })
    return syncManager
  }

  async function openSession() {
    const version = ++sessionVersion
    identityLoading.value = true
    identityError.value = null

    try {
      const nextAccountId = mockMode
        ? MOCK_YOUTUBE_ACCOUNT_ID
        : await loadYouTubeAccountId(client())

      if (version !== sessionVersion) {
        return
      }

      accountId.value = nextAccountId
      preferences.value = loadContentPreferences(nextAccountId)
      unsubscribeSync?.()
      const manager = ensureSyncManager()
      unsubscribeSync = manager.subscribe(nextAccountId, handleSyncState)
      await manager.open(nextAccountId)
    } catch (error) {
      if (version !== sessionVersion) {
        return
      }

      const normalized = normalizeYouTubeSyncError(error)
      identityError.value = normalized
      reportAuthorizationFailure(normalized)
    } finally {
      if (version === sessionVersion) {
        identityLoading.value = false
      }
    }
  }

  function handleSyncState(nextState: YouTubeSyncState) {
    syncState.value = nextState

    if (nextState.error) {
      reportAuthorizationFailure(nextState.error)
    }
  }

  function reportAuthorizationFailure(error: YouTubeSyncError) {
    const kinds = new Set([
      error.kind,
      ...error.channelErrors.map((channelError) => channelError.kind)
    ])

    if (kinds.has('token_expired')) {
      auth.reportExpired()
    } else if (kinds.has('permission_revoked')) {
      void clearApiCache(accountId.value)
      auth.reportRevoked()
    }
  }

  function resetSession() {
    sessionVersion += 1
    unsubscribeSync?.()
    unsubscribeSync = null
    accountId.value = null
    syncState.value = null
    identityLoading.value = false
    identityError.value = null
    preferences.value = null
  }

  async function refresh() {
    if (!accountId.value) {
      if (mockMode || auth.status.value === 'connected') {
        await openSession()
      }

      return
    }

    identityError.value = null
    await ensureSyncManager().refresh(accountId.value)
  }

  async function clearApiCache(targetAccountId = accountId.value) {
    if (!targetAccountId || !syncManager) {
      return
    }

    await syncManager.disconnect(targetAccountId)
  }

  async function disconnectAccount() {
    if (mockMode) {
      return
    }

    const connectedAccountId = accountId.value
    await auth.revoke()

    if (auth.status.value === 'revoked') {
      await clearApiCache(connectedAccountId)
      resetSession()
      clearNuxtData((key) => key.startsWith('youtube-api:'))
    }
  }

  async function clearAllLocalData() {
    const connectedAccountId = accountId.value
    clearAllAppLocalData()
    preferences.value = connectedAccountId
      ? createContentPreferences(connectedAccountId)
      : null
    await clearApiCache(connectedAccountId)

    if (!mockMode) {
      await auth.revoke()

      if (auth.status.value !== 'revoked') {
        auth.disconnect()
      }
    }

    resetSession()
    clearNuxtData((key) => key.startsWith('youtube-api:'))

    if (mockMode) {
      await openSession()
    }
  }

  function channelRule(channelId: string): ChannelContentRule {
    return preferences.value
      ? getChannelContentRule(preferences.value, channelId)
      : createChannelContentRule()
  }

  function updateChannelExcluded(channelId: string, excluded: boolean) {
    updatePreferences((current) => setChannelExcluded(current, channelId, excluded))
  }

  function updateCategoryExcluded(
    channelId: string,
    category: VideoContentCategory,
    excluded: boolean
  ) {
    updatePreferences((current) =>
      setContentCategoryExcluded(current, channelId, category, excluded)
    )
  }

  function updatePreferences(
    update: (current: AccountContentPreferences) => AccountContentPreferences
  ) {
    if (!preferences.value) {
      return
    }

    preferences.value = update(preferences.value)
    saveContentPreferences(preferences.value)
  }

  onMounted(() => {
    if (mockMode) {
      void openSession()
      return
    }

    stopAuthWatch = watch(
      auth.status,
      (status) => {
        if (status === 'connected') {
          void openSession()
        } else if (!['requesting', 'expired'].includes(status)) {
          resetSession()
        }
      },
      { immediate: true }
    )
  })

  onScopeDispose(() => {
    sessionVersion += 1
    stopAuthWatch?.()
    unsubscribeSync?.()
    cache?.close()
  })

  return {
    accountId: computed(() => accountId.value),
    auth,
    channelRule,
    clearAllLocalData,
    data,
    disconnectAccount,
    error,
    failedChannelIds,
    identityLoading: computed(() => identityLoading.value),
    mockMode,
    refresh,
    refreshing,
    syncState: computed(() => syncState.value),
    updateCategoryExcluded,
    updateChannelExcluded
  }
}

function isExplicitTrue(value: unknown): boolean {
  return value === true || value === 'true' || value === '1'
}
