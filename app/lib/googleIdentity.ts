import type { GoogleOAuth2Api } from './youtubeAuth'

export const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

interface GoogleIdentityWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: GoogleOAuth2Api
    }
  }
}

let loadPromise: Promise<GoogleOAuth2Api> | null = null

export function loadGoogleOAuth2(): Promise<GoogleOAuth2Api> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Identity Services requires a browser.'))
  }

  const loadedApi = getLoadedApi()

  if (loadedApi) {
    return Promise.resolve(loadedApi)
  }

  loadPromise ??= new Promise<GoogleOAuth2Api>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_URL}"]`
    )
    const script = existingScript ?? document.createElement('script')

    const cleanup = () => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }
    const handleLoad = () => {
      cleanup()
      const api = getLoadedApi()

      if (api) {
        resolve(api)
      } else {
        loadPromise = null
        reject(new Error('Google Identity Services loaded without OAuth support.'))
      }
    }
    const handleError = () => {
      cleanup()
      loadPromise = null
      reject(new Error('Google Identity Services failed to load.'))
    }

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleError)

    if (!existingScript) {
      script.src = GOOGLE_IDENTITY_SCRIPT_URL
      script.async = true
      document.head.append(script)
    }
  })

  return loadPromise
}

function getLoadedApi(): GoogleOAuth2Api | undefined {
  return (window as GoogleIdentityWindow).google?.accounts?.oauth2
}
