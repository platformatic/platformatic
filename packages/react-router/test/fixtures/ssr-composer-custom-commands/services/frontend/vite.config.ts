import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ isSsrBuild }) => ({
  base: globalThis.platformatic?.basePath ?? '/',
  build: {
    rollupOptions: isSsrBuild ? { input: './app/server.ts' } : undefined
  },
  plugins: [reactRouter(), tsconfigPaths()],
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
}))
