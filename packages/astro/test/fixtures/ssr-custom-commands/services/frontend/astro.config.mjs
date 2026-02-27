import node from '@astrojs/node'
import { ensureTrailingSlash } from '@platformatic/basic'
import { defineConfig } from 'vite'

const basePath = ensureTrailingSlash(globalThis.platformatic?.basePath ?? '/')

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'middleware'
  }),
  base: basePath,
  logLevel: globalThis.platformatic?.logLevel ?? 'info',
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
          globalThis.platformatic.events.emitAndNotify('vite:config', config, process.pid)
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
    }
  }
})
