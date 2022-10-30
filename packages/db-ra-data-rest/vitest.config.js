/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['**/test/e2e/**', 'node_modules/**'],
    setupFiles: ["./test-setup"]
  }
})
