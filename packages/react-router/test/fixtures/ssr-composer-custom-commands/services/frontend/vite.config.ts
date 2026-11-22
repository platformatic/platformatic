import { getBasePath, registerCloseCallback } from '@platformatic/globals'
import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ isSsrBuild }) => ({
  base: getBasePath({ throwOnMissing: false }) ?? '/',
  // v7: isSsrBuild + top-level build.rollupOptions.input
  build: {
    rollupOptions: isSsrBuild ? { input: './app/server.ts' } : undefined
  },
  // v8: Vite Environment API is always on; top-level isSsrBuild input is ignored
  // https://reactrouter.com/upgrading/v7
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          input: './app/server.ts'
        }
      }
    }
  },
  plugins: [
    reactRouter(),
    tsconfigPaths(),
    {
      name: 'platformatic',
      configureServer: server => {
        registerCloseCallback(() => server.close())
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
}))
