import { ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath, getITC, getLogLevel } from '@platformatic/globals'
import { defineConfig } from 'vite'

const basePath = ensureTrailingSlash(getBasePath(false) ?? '/')

export default defineConfig({
  base: basePath,
  logLevel: getLogLevel(false) ?? 'info',
  integrations: [
    {
      name: 'platformatic',
      hooks: {
        'astro:config:setup': ({ config }) => {
          config.vite.server ??= {}
          config.vite.server.hmr ??= {}
          config.vite.server.hmr.path = basePath
        },
        'astro:config:done': ({ config }) => {
          const itc = getITC()
          itc.notify('config', config, process.pid)
        }
      }
    }
  ],
  vite: {
    server: {
      fs: {
        strict: false
      },
      allowedHosts: ['.plt.local']
    },
    preview: {
      allowedHosts: ['.plt.local']
    }
  }
})
