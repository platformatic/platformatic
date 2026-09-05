import { defineNuxtConfig } from 'nuxt/config'
import { externalizePlatformaticGlobals } from '@platformatic/globals'

export default defineNuxtConfig({
  compatibilityDate: '2026-06-15',
  telemetry: false,
  devtools: { enabled: false },
  nitro: {
    modules: [externalizePlatformaticGlobals]
  },
  vite: {
    server: {
      allowedHosts: ['.plt.local']
    }
  }
})
