export const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'
export const YOUTUBE_AUTH_PROBE_URL =
  'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&maxResults=1'

export type YouTubeAuthStatus =
  | 'disconnected'
  | 'requesting'
  | 'connected'
  | 'expired'
  | 'denied'
  | 'revoked'
  | 'missing_configuration'

export type YouTubeAuthProbeStatus = 'idle' | 'checking' | 'success' | 'error'

export interface YouTubeAuthSnapshot {
  status: YouTubeAuthStatus
  expiresAt: number | null
  error: string | null
  probeStatus: YouTubeAuthProbeStatus
  probeMessage: string | null
}

export interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

export interface GoogleOAuthError {
  type?: 'popup_closed' | 'popup_failed_to_open' | 'unknown' | string
}

export interface GoogleRevocationResponse {
  successful: boolean
  error?: string
  error_description?: string
}

export interface GoogleTokenClient {
  requestAccessToken(config?: { prompt?: string }): void
}

export interface GoogleOAuth2Api {
  initTokenClient(config: {
    client_id: string
    scope: string
    include_granted_scopes: boolean
    callback: (response: GoogleTokenResponse) => void
    error_callback: (error: GoogleOAuthError) => void
  }): GoogleTokenClient
  revoke(accessToken: string, callback: (response: GoogleRevocationResponse) => void): void
}

export interface YouTubeAuthManager {
  connect(): Promise<void>
  reauthorize(): Promise<void>
  disconnect(): void
  revoke(): Promise<void>
  probe(): Promise<void>
  reportExpired(): void
  reportRevoked(): void
  getAccessToken(): string | null
  getSnapshot(): YouTubeAuthSnapshot
  subscribe(listener: (snapshot: YouTubeAuthSnapshot) => void): () => void
  destroy(): void
}

interface YouTubeAuthManagerOptions {
  clientId?: string
  loadOAuth2: () => Promise<GoogleOAuth2Api>
  fetcher?: typeof fetch
  clearYoutubeData?: () => void | Promise<void>
  now?: () => number
}

const initialProbeState = {
  probeStatus: 'idle' as const,
  probeMessage: null
}

export function createYouTubeAuthManager(options: YouTubeAuthManagerOptions): YouTubeAuthManager {
  const clientId = options.clientId?.trim() ?? ''
  const fetcher = options.fetcher ?? globalThis.fetch
  const now = options.now ?? Date.now
  const listeners = new Set<(snapshot: YouTubeAuthSnapshot) => void>()

  let snapshot: YouTubeAuthSnapshot = {
    status: clientId ? 'disconnected' : 'missing_configuration',
    expiresAt: null,
    error: clientId ? null : 'Falta configurar NUXT_PUBLIC_GOOGLE_CLIENT_ID.',
    ...initialProbeState
  }
  let accessToken: string | null = null
  let expiryTimer: ReturnType<typeof setTimeout> | null = null
  let oauth2Promise: Promise<GoogleOAuth2Api> | null = null
  let tokenClient: GoogleTokenClient | null = null

  function emit(next: Partial<YouTubeAuthSnapshot>) {
    snapshot = { ...snapshot, ...next }
    const current = getSnapshot()

    for (const listener of listeners) {
      listener(current)
    }
  }

  function getSnapshot(): YouTubeAuthSnapshot {
    return { ...snapshot }
  }

  function isRequesting(): boolean {
    return snapshot.status === 'requesting'
  }

  function clearExpiryTimer() {
    if (expiryTimer !== null) {
      clearTimeout(expiryTimer)
      expiryTimer = null
    }
  }

  function expireToken() {
    clearExpiryTimer()
    emit({
      status: 'expired',
      error: 'La autorización ha caducado. Vuelve a autorizar para continuar.',
      ...initialProbeState
    })
  }

  function reportRevoked() {
    clearToken()
    clearYoutubeData()
    emit({
      status: 'revoked',
      expiresAt: null,
      error: 'YouTube ha revocado o rechazado el permiso. Vuelve a conectar la cuenta.',
      ...initialProbeState
    })
  }

  function clearToken() {
    accessToken = null
    clearExpiryTimer()
  }

  function clearYoutubeData() {
    void Promise.resolve(options.clearYoutubeData?.()).catch(() => {
      // Clearing session data must not restore or retain an OAuth token.
    })
  }

  function handleTokenResponse(response: GoogleTokenResponse) {
    if (snapshot.status !== 'requesting') {
      return
    }

    if (response.error) {
      clearToken()
      emit({
        status: response.error === 'access_denied' ? 'denied' : 'disconnected',
        expiresAt: null,
        error: oauthErrorMessage(response.error, response.error_description),
        ...initialProbeState
      })
      return
    }

    const expiresInSeconds = Number(response.expires_in)
    const grantedScopes = new Set((response.scope ?? '').split(/\s+/).filter(Boolean))

    if (!response.access_token || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
      clearToken()
      emit({
        status: 'denied',
        expiresAt: null,
        error: 'Google no devolvió una autorización válida.',
        ...initialProbeState
      })
      return
    }

    if (!grantedScopes.has(YOUTUBE_READONLY_SCOPE)) {
      clearToken()
      emit({
        status: 'denied',
        expiresAt: null,
        error: 'No se concedió el permiso de solo lectura de YouTube.',
        ...initialProbeState
      })
      return
    }

    accessToken = response.access_token
    const expiresAt = now() + expiresInSeconds * 1000
    clearExpiryTimer()
    expiryTimer = setTimeout(expireToken, expiresInSeconds * 1000)
    emit({
      status: 'connected',
      expiresAt,
      error: null,
      ...initialProbeState
    })
  }

  function handleGoogleError(error: GoogleOAuthError) {
    if (snapshot.status !== 'requesting') {
      return
    }

    clearToken()
    emit({
      status: 'denied',
      expiresAt: null,
      error: googlePopupErrorMessage(error.type),
      ...initialProbeState
    })
  }

  async function getTokenClient(): Promise<GoogleTokenClient> {
    if (tokenClient) {
      return tokenClient
    }

    oauth2Promise ??= options.loadOAuth2()
    const oauth2 = await oauth2Promise
    tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: YOUTUBE_READONLY_SCOPE,
      include_granted_scopes: false,
      callback: handleTokenResponse,
      error_callback: handleGoogleError
    })

    return tokenClient
  }

  async function requestAccessToken(prompt: 'consent' | '') {
    if (!clientId) {
      emit({
        status: 'missing_configuration',
        expiresAt: null,
        error: 'Falta configurar NUXT_PUBLIC_GOOGLE_CLIENT_ID.',
        ...initialProbeState
      })
      return
    }

    if (snapshot.status === 'requesting') {
      return
    }

    clearToken()
    emit({ status: 'requesting', expiresAt: null, error: null, ...initialProbeState })

    try {
      const client = await getTokenClient()

      if (isRequesting()) {
        client.requestAccessToken({ prompt })
      }
    } catch {
      emit({
        status: 'disconnected',
        expiresAt: null,
        error: 'No se pudo cargar Google Identity Services.',
        ...initialProbeState
      })
    }
  }

  function disconnect() {
    clearToken()
    clearYoutubeData()
    emit({
      status: clientId ? 'disconnected' : 'missing_configuration',
      expiresAt: null,
      error: clientId ? null : 'Falta configurar NUXT_PUBLIC_GOOGLE_CLIENT_ID.',
      ...initialProbeState
    })
  }

  async function revoke() {
    const tokenToRevoke = accessToken

    if (!tokenToRevoke) {
      clearToken()
      clearYoutubeData()
      emit({
        status: 'revoked',
        expiresAt: null,
        error: null,
        ...initialProbeState
      })
      return
    }

    const previousStatus = snapshot.status
    emit({ status: 'requesting', error: null, ...initialProbeState })

    try {
      oauth2Promise ??= options.loadOAuth2()
      const oauth2 = await oauth2Promise

      await new Promise<void>((resolve) => {
        oauth2.revoke(tokenToRevoke, (response) => {
          if (response.successful || response.error === 'invalid_token') {
            clearToken()
            clearYoutubeData()
            emit({
              status: 'revoked',
              expiresAt: null,
              error: null,
              ...initialProbeState
            })
          } else {
            emit({
              status: previousStatus,
              error: 'Google no pudo revocar el consentimiento. Inténtalo de nuevo.'
            })
          }
          resolve()
        })
      })
    } catch {
      emit({
        status: previousStatus,
        error: 'No se pudo contactar con Google para revocar el consentimiento.'
      })
    }
  }

  function getAccessToken(): string | null {
    if (snapshot.status !== 'connected' || !accessToken || !snapshot.expiresAt) {
      return null
    }

    if (now() >= snapshot.expiresAt) {
      expireToken()
      return null
    }

    return accessToken
  }

  async function probe() {
    const token = getAccessToken()

    if (!token) {
      emit({
        probeStatus: 'error',
        probeMessage: 'Necesitas una autorización vigente para probar el acceso.'
      })
      return
    }

    emit({ probeStatus: 'checking', probeMessage: 'Comprobando acceso de solo lectura…' })

    try {
      const response = await fetcher(YOUTUBE_AUTH_PROBE_URL, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      })

      if (response.ok) {
        emit({
          probeStatus: 'success',
          probeMessage: 'Acceso de solo lectura a YouTube verificado.'
        })
        return
      }

      if (response.status === 401) {
        clearToken()
        clearYoutubeData()
        emit({
          status: 'revoked',
          expiresAt: null,
          error: 'YouTube rechazó la autorización. Vuelve a conectar la cuenta.',
          probeStatus: 'error',
          probeMessage: 'La petición autenticada fue rechazada.'
        })
        return
      }

      emit({
        probeStatus: 'error',
        probeMessage: `YouTube rechazó la comprobación (${response.status}).`
      })
    } catch {
      emit({
        probeStatus: 'error',
        probeMessage: 'No se pudo completar la comprobación de YouTube.'
      })
    }
  }

  return {
    connect: () => requestAccessToken('consent'),
    reauthorize: () => requestAccessToken(''),
    disconnect,
    revoke,
    probe,
    reportExpired: expireToken,
    reportRevoked,
    getAccessToken,
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      listener(getSnapshot())
      return () => listeners.delete(listener)
    },
    destroy() {
      clearToken()
      listeners.clear()
    }
  }
}

function oauthErrorMessage(error: string, description?: string): string {
  if (error === 'access_denied') {
    return 'No se concedió el permiso de solo lectura de YouTube.'
  }

  if (error === 'interaction_required') {
    return 'Google necesita que vuelvas a autorizar la cuenta.'
  }

  return description
    ? `Google rechazó la autorización: ${description}`
    : 'Google rechazó la autorización.'
}

function googlePopupErrorMessage(type?: string): string {
  if (type === 'popup_closed') {
    return 'Se cerró la ventana de Google antes de completar la autorización.'
  }

  if (type === 'popup_failed_to_open') {
    return 'El navegador bloqueó la ventana de autorización de Google.'
  }

  return 'No se pudo completar la autorización con Google.'
}
