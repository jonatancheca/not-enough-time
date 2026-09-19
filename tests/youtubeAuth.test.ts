import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createYouTubeAuthManager,
  YOUTUBE_AUTH_PROBE_URL,
  YOUTUBE_READONLY_SCOPE,
  type GoogleOAuth2Api,
  type GoogleTokenClient,
  type GoogleTokenResponse
} from '../app/lib/youtubeAuth'

describe('YouTube OAuth manager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports missing configuration without loading Google', async () => {
    const loadOAuth2 = vi.fn<() => Promise<GoogleOAuth2Api>>()
    const manager = createYouTubeAuthManager({ loadOAuth2 })

    expect(manager.getSnapshot()).toMatchObject({
      status: 'missing_configuration',
      expiresAt: null
    })

    await manager.connect()

    expect(loadOAuth2).not.toHaveBeenCalled()
    expect(manager.getAccessToken()).toBeNull()
  })

  it('requests only youtube.readonly and keeps the token outside snapshots', async () => {
    const google = createGoogleOAuthFake()
    const manager = createYouTubeAuthManager({
      clientId: 'test-client.apps.googleusercontent.com',
      loadOAuth2: async () => google.oauth2
    })

    await manager.connect()

    expect(google.initTokenClient).toHaveBeenCalledWith(expect.objectContaining({
      client_id: 'test-client.apps.googleusercontent.com',
      scope: YOUTUBE_READONLY_SCOPE,
      include_granted_scopes: false
    }))
    expect(google.requestAccessToken).toHaveBeenCalledWith({ prompt: 'consent' })

    google.respondWithToken({
      access_token: 'memory-only-token',
      expires_in: 3600,
      scope: YOUTUBE_READONLY_SCOPE
    })

    expect(manager.getSnapshot()).toMatchObject({ status: 'connected', error: null })
    expect(JSON.stringify(manager.getSnapshot())).not.toContain('memory-only-token')
    expect(manager.getAccessToken()).toBe('memory-only-token')
  })

  it('expires the in-memory token and supports reauthorization', async () => {
    const google = createGoogleOAuthFake()
    const manager = createYouTubeAuthManager({
      clientId: 'test-client.apps.googleusercontent.com',
      loadOAuth2: async () => google.oauth2
    })

    await manager.connect()
    google.respondWithToken({
      access_token: 'short-lived-token',
      expires_in: 2,
      scope: YOUTUBE_READONLY_SCOPE
    })

    await vi.advanceTimersByTimeAsync(2000)

    expect(manager.getSnapshot().status).toBe('expired')
    expect(manager.getAccessToken()).toBeNull()

    await manager.reauthorize()

    expect(google.requestAccessToken).toHaveBeenLastCalledWith({ prompt: '' })
    expect(manager.getSnapshot().status).toBe('requesting')
  })

  it('maps denied permission and popup errors to a readable denied state', async () => {
    const google = createGoogleOAuthFake()
    const manager = createYouTubeAuthManager({
      clientId: 'test-client.apps.googleusercontent.com',
      loadOAuth2: async () => google.oauth2
    })

    await manager.connect()
    google.respondWithToken({ error: 'access_denied' })

    expect(manager.getSnapshot()).toMatchObject({
      status: 'denied',
      error: 'No se concedió el permiso de solo lectura de YouTube.'
    })

    await manager.connect()
    google.respondWithPopupError('popup_closed')

    expect(manager.getSnapshot()).toMatchObject({
      status: 'denied',
      error: 'Se cerró la ventana de Google antes de completar la autorización.'
    })
  })

  it('disconnects without revoking and clears YouTube session data', async () => {
    const google = createGoogleOAuthFake()
    const clearYoutubeData = vi.fn()
    const manager = createYouTubeAuthManager({
      clientId: 'test-client.apps.googleusercontent.com',
      loadOAuth2: async () => google.oauth2,
      clearYoutubeData
    })

    await manager.connect()
    google.respondWithToken({
      access_token: 'token-to-forget',
      expires_in: 3600,
      scope: YOUTUBE_READONLY_SCOPE
    })
    manager.disconnect()

    expect(manager.getSnapshot().status).toBe('disconnected')
    expect(manager.getAccessToken()).toBeNull()
    expect(clearYoutubeData).toHaveBeenCalledOnce()
    expect(google.revoke).not.toHaveBeenCalled()
  })

  it('revokes consent and treats an already invalid token as revoked', async () => {
    const google = createGoogleOAuthFake()
    const clearYoutubeData = vi.fn()
    const manager = createYouTubeAuthManager({
      clientId: 'test-client.apps.googleusercontent.com',
      loadOAuth2: async () => google.oauth2,
      clearYoutubeData
    })

    await manager.connect()
    google.respondWithToken({
      access_token: 'token-to-revoke',
      expires_in: 3600,
      scope: YOUTUBE_READONLY_SCOPE
    })

    google.revoke.mockImplementation((_token, callback) => {
      callback({ successful: false, error: 'invalid_token' })
    })

    await manager.revoke()

    expect(google.revoke).toHaveBeenCalledWith('token-to-revoke', expect.any(Function))
    expect(manager.getSnapshot().status).toBe('revoked')
    expect(manager.getAccessToken()).toBeNull()
    expect(clearYoutubeData).toHaveBeenCalledOnce()
  })

  it('probes YouTube with a bearer token and no API key', async () => {
    const google = createGoogleOAuthFake()
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }))
    const manager = createYouTubeAuthManager({
      clientId: 'test-client.apps.googleusercontent.com',
      loadOAuth2: async () => google.oauth2,
      fetcher
    })

    await manager.connect()
    google.respondWithToken({
      access_token: 'probe-token',
      expires_in: 3600,
      scope: YOUTUBE_READONLY_SCOPE
    })
    await manager.probe()

    expect(fetcher).toHaveBeenCalledWith(YOUTUBE_AUTH_PROBE_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer probe-token'
      }
    })
    expect(YOUTUBE_AUTH_PROBE_URL).not.toContain('key=')
    expect(manager.getSnapshot()).toMatchObject({
      status: 'connected',
      probeStatus: 'success'
    })
  })

  it('moves to revoked when YouTube rejects the bearer token', async () => {
    const google = createGoogleOAuthFake()
    const clearYoutubeData = vi.fn()
    const manager = createYouTubeAuthManager({
      clientId: 'test-client.apps.googleusercontent.com',
      loadOAuth2: async () => google.oauth2,
      fetcher: vi.fn(async () => new Response(null, { status: 401 })),
      clearYoutubeData
    })

    await manager.connect()
    google.respondWithToken({
      access_token: 'revoked-token',
      expires_in: 3600,
      scope: YOUTUBE_READONLY_SCOPE
    })
    await manager.probe()

    expect(manager.getSnapshot()).toMatchObject({
      status: 'revoked',
      probeStatus: 'error'
    })
    expect(manager.getAccessToken()).toBeNull()
    expect(clearYoutubeData).toHaveBeenCalledOnce()
  })
})

function createGoogleOAuthFake() {
  let tokenCallback: ((response: GoogleTokenResponse) => void) | undefined
  let errorCallback: ((error: { type: string }) => void) | undefined
  const requestAccessToken = vi.fn<GoogleTokenClient['requestAccessToken']>()
  const initTokenClient = vi.fn<GoogleOAuth2Api['initTokenClient']>((config) => {
    tokenCallback = config.callback
    errorCallback = config.error_callback
    return { requestAccessToken }
  })
  const revoke = vi.fn<GoogleOAuth2Api['revoke']>()

  return {
    oauth2: { initTokenClient, revoke } satisfies GoogleOAuth2Api,
    initTokenClient,
    requestAccessToken,
    revoke,
    respondWithToken(response: GoogleTokenResponse) {
      tokenCallback?.(response)
    },
    respondWithPopupError(type: string) {
      errorCallback?.({ type })
    }
  }
}
