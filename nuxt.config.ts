// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  app: {
    head: {
      title: 'Not Enough Time',
      meta: [
        {
          name: 'description',
          content: 'Dashboard mock para estimar las horas de YouTube que publican tus canales suscritos.'
        }
      ]
    }
  }
})
