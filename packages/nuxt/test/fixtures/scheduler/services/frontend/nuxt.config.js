import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2026-06-15',
  telemetry: false,
  devtools: { enabled: false },
  modules: ['@platformatic/nuxt/scheduler'],
  nitro: {
    scheduledTasks: {
      '0 0 1 1 *': ['smoke']
    }
  }
})
