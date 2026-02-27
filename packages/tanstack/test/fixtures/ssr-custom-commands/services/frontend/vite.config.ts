import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: globalThis.platformatic?.basePath ?? '/',
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    process.env.NODE_ENV === 'production' &&
      nitro({
        preset: 'node-server',
        output: {
          dir: 'dist'
        }
      }),
    viteReact(),
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
