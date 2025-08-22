import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'

export default defineConfig({
  base: globalThis.platformatic?.basePath ?? '/',
  plugins: [
    remix({
      basename: globalThis.platformatic?.basePath ?? '/',
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true
      }
    })
  ],
  server: {
    allowedHosts: ['.plt.local']
  }
})
