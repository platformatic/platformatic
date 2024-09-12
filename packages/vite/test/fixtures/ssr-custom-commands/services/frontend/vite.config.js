import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const path = fileURLToPath(import.meta.url)
const root = resolve(dirname(path), 'client')

export default {
  root,
  base: globalThis.platformatic?.basePath ?? '/',
  logLevel: globalThis.platformatic?.logLevel ?? 'info',
  plugins: [
    {
      name: 'platformatic',
      configResolved: config => {
        globalThis[Symbol.for('plt.children.itc')]?.notify('config', config)
      }
    }
  ],
  // This is needed for GitHub actions due to https://github.com/vitejs/vite/issues/10802
  resolve: {
    preserveSymlinks: true
  }
}
