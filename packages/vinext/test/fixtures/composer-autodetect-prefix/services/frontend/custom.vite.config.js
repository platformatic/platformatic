import { fileURLToPath } from 'node:url'
import vinext from 'vinext'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/nested/base/dir/',
  plugins: [vinext({ appDir: fileURLToPath(globalThis.platformatic.root) })],
  logLevel: globalThis.platformatic?.logLevel ?? 'info'
})
