import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'

export default defineConfig({
  base: globalThis.platformatic?.basePath ?? '/',
  plugins: [
    remix({ basename: globalThis.platformatic?.basePath ?? '/' }),
    {
      name: 'platformatic',
      configResolved: config => {
        globalThis.platformatic.events.emitAndNotify('vite:config', config)
      }
    }
  ],
  server: {
    fs: {
      strict: false
    },
    allowedHosts: ['.plt.local']
  },
  // This is needed for GitHub actions due to https://github.com/vitejs/vite/issues/10802
  resolve: {
    preserveSymlinks: true
  }
})
