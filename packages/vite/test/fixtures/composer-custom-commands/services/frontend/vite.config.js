import { defineConfig } from 'vite'

export default defineConfig({
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
  resolve: {
    preserveSymlinks: true
  }
})
