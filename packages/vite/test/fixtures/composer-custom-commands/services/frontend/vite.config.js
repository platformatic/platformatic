import { getBasePath, getITC, getLogLevel, registerCloseCallback } from '@platformatic/globals'
import { defineConfig } from 'vite'

export default defineConfig({
  base: getBasePath({ throwOnMissing: false }) ?? '/',
  logLevel: getLogLevel({ throwOnMissing: false }) ?? 'info',
  plugins: [
    {
      name: 'platformatic',
      configureServer: server => {
        registerCloseCallback(() => server.close())
      },
      configurePreviewServer: server => {
        registerCloseCallback(() => server.httpServer[Symbol.asyncDispose]())
      },
      configResolved: config => {
        const itc = getITC()
        itc.notify('config', config)
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
