/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['**/test/e2e/**', 'node_modules/**'],
    setupFiles: ['./test-setup'],
    coverage: {
      all: true,
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100
    }
  }
})
