import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'

export default defineConfig({
  base: globalThis.platformatic?.basePath ?? '/',
  plugins: [
    remix({ basename: globalThis.platformatic?.basePath ?? '/' }),
    {
      name: 'platformatic',
      configResolved: config => {
        globalThis[Symbol.for('plt.children.itc')]?.notify('config', config)
      }
    }
  ],
  server: {
    fs: {
      strict: false
    }
  }
})
