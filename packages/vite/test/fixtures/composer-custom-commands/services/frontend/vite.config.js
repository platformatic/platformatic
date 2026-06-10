import { getBasePath, getITC, getLogLevel } from '@platformatic/globals'
import { defineConfig } from 'vite'

export default defineConfig({
  base: getBasePath({ throwOnMissing: false }) ?? '/',
  logLevel: getLogLevel({ throwOnMissing: false }) ?? 'info',
  plugins: [
    {
      name: 'platformatic',
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
