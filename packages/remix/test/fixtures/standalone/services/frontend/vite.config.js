import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [remix()],
  // This is needed for GitHub actions due to https://github.com/vitejs/vite/issues/10802
  resolve: {
    preserveSymlinks: true
  }
})
