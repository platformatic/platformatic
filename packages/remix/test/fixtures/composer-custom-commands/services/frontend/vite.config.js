import { getBasePath, getITC } from '@platformatic/globals'
import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'

export default defineConfig({
  base: getBasePath(false) ?? '/',
  plugins: [
    remix({ basename: getBasePath(false) ?? '/' }),
    {
      name: 'platformatic',
      configResolved: config => {
        const itc = getITC()
        itc.notify('config', config)
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
