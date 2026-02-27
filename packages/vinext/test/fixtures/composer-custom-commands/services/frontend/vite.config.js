import { fileURLToPath } from 'node:url'
import vinext from 'vinext'
import { defineConfig } from 'vite'

export default defineConfig({
  base: globalThis.platformatic?.basePath ?? '/',
  logLevel: globalThis.platformatic?.logLevel ?? 'info',
  plugins: [
    vinext({ appDir: fileURLToPath(globalThis.platformatic.root) }),
    {
      name: 'platformatic',
      configResolved: config => {
        globalThis.platformatic.events?.emitAndNotify('vite:config', { ...config, plugins: undefined })
      }
    }
  ],
  // This is needed for GitHub actions due to https://github.com/vitejs/vite/issues/10802
  resolve: {
    preserveSymlinks: true
  },
  server: {
    allowedHosts: ['.plt.local']
  }
})
