// https://nuxt.com/docs/api/configuration/nuxt-config
const repositoryName = 'not-enough-time'
const baseURL = process.env.GITHUB_ACTIONS === 'true' ? `/${repositoryName}/` : '/'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  runtimeConfig: {
    public: {
      googleClientId: '',
      useYoutubeMock: false
    }
  },
  app: {
    baseURL,
    head: {
      title: 'Not Enough Time',
      meta: [
        {
          name: 'description',
          content: 'Mide la carga de publicación de tus suscripciones de YouTube frente a tu capacidad diaria.'
        },
        {
          name: 'referrer',
          content: 'no-referrer-when-downgrade'
        }
      ],
      script: [
        {
          src: 'https://accounts.google.com/gsi/client',
          async: true
        }
      ]
    }
  }
})
