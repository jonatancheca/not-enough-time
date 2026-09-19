export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxtjs/tailwindcss'],
  compatibilityDate: '2025-07-15',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  eslint: {
    config: {
      stylistic: true
    }
  },
  runtimeConfig: {
    public: {
      googleClientId: '',
      useYoutubeMock: false
    }
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'es'
      },
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
