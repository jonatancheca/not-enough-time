import type { YouTubeAuthStatus } from './youtubeAuth'
import type { YouTubeSyncError, YouTubeSyncState } from './youtubeSync'

export type WatchloadViewState =
  | 'configuration_missing'
  | 'disconnected'
  | 'authorizing'
  | 'expired'
  | 'revoked'
  | 'loading'
  | 'syncing'
  | 'empty_subscriptions'
  | 'empty_eligible'
  | 'partial'
  | 'stale'
  | 'recoverable_error'
  | 'blocking_error'
  | 'ready'

export interface WatchloadViewInput {
  authStatus: YouTubeAuthStatus
  mockMode: boolean
  identityLoading: boolean
  error: YouTubeSyncError | null
  syncState: YouTubeSyncState | null
  subscriptionCount: number
  eligibleVideoCount: number
}

export function selectWatchloadViewState(input: WatchloadViewInput): WatchloadViewState {
  if (!input.mockMode) {
    if (input.authStatus === 'missing_configuration') {
      return 'configuration_missing'
    }

    if (input.authStatus === 'requesting') {
      return 'authorizing'
    }

    if (input.authStatus === 'expired') {
      return 'expired'
    }

    if (input.authStatus === 'revoked') {
      return 'revoked'
    }

    if (input.authStatus !== 'connected') {
      return 'disconnected'
    }
  }

  const syncState = input.syncState

  if (input.identityLoading || (!syncState?.snapshot && syncState?.refreshing)) {
    return 'loading'
  }

  if (!syncState && input.error) {
    return input.error.recoverable ? 'recoverable_error' : 'blocking_error'
  }

  if (!syncState) {
    return 'loading'
  }

  if (syncState.partial) {
    return 'partial'
  }

  if (syncState.error) {
    return syncState.error.recoverable ? 'recoverable_error' : 'blocking_error'
  }

  if (syncState.refreshing) {
    return 'syncing'
  }

  if (syncState.stale) {
    return 'stale'
  }

  if (!syncState.snapshot) {
    return 'loading'
  }

  if (input.subscriptionCount === 0) {
    return 'empty_subscriptions'
  }

  if (input.eligibleVideoCount === 0) {
    return 'empty_eligible'
  }

  return 'ready'
}
