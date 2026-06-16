import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2026-06-15',
  telemetry: false,
  devtools: { enabled: false },
  vite: {
    server: {
      allowedHosts: ['.plt.local']
    }
  }
})
