import { defineConfig } from 'vite'

export default defineConfig({
  base: globalThis.platformatic?.basePath ?? '/',
  logLevel: globalThis.platformatic?.logLevel ?? 'info',
  plugins: [
    {
      name: 'platformatic',
      configResolved: config => {
        globalThis.platformatic.events.emitAndNotify('vite:config', config)
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
