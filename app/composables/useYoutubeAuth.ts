import { computed, readonly, ref } from 'vue'
import { loadGoogleOAuth2 } from '~/lib/googleIdentity'
import {
  createYouTubeAuthManager,
  type YouTubeAuthManager,
  type YouTubeAuthSnapshot
} from '~/lib/youtubeAuth'

const YOUTUBE_API_DATA_PREFIX = 'youtube-api:'
const snapshot = ref<YouTubeAuthSnapshot>({
  status: 'disconnected',
  expiresAt: null,
  error: null,
  probeStatus: 'idle',
  probeMessage: null
})

let manager: YouTubeAuthManager | null = null
let configuredClientId: string | null = null

export function useYoutubeAuth() {
  const config = useRuntimeConfig()
  const clientId = String(config.public.googleClientId ?? '').trim()

  if (import.meta.client) {
    initializeManager(clientId)
  } else if (!clientId) {
    snapshot.value = {
      status: 'missing_configuration',
      expiresAt: null,
      error: 'Falta configurar NUXT_PUBLIC_GOOGLE_CLIENT_ID.',
      probeStatus: 'idle',
      probeMessage: null
    }
  }

  return {
    status: computed(() => snapshot.value.status),
    expiresAt: computed(() => snapshot.value.expiresAt),
    error: computed(() => snapshot.value.error),
    probeStatus: computed(() => snapshot.value.probeStatus),
    probeMessage: computed(() => snapshot.value.probeMessage),
    snapshot: readonly(snapshot),
    connect: () => getManager(clientId).connect(),
    reauthorize: () => getManager(clientId).reauthorize(),
    disconnect: () => getManager(clientId).disconnect(),
    revoke: () => getManager(clientId).revoke(),
    probe: () => getManager(clientId).probe(),
    reportExpired: () => getManager(clientId).reportExpired(),
    reportRevoked: () => getManager(clientId).reportRevoked(),
    getAccessToken: () => getManager(clientId).getAccessToken()
  }
}

function getManager(clientId: string): YouTubeAuthManager {
  initializeManager(clientId)
  return manager!
}

function initializeManager(clientId: string) {
  if (manager && configuredClientId === clientId) {
    return
  }

  manager?.destroy()
  configuredClientId = clientId
  manager = createYouTubeAuthManager({
    clientId,
    loadOAuth2: loadGoogleOAuth2,
    clearYoutubeData: () => {
      clearNuxtData((key) => key.startsWith(YOUTUBE_API_DATA_PREFIX))
    }
  })
  manager.subscribe((nextSnapshot) => {
    snapshot.value = nextSnapshot
  })
}
