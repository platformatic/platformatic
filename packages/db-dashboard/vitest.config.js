/// <reference types="vitest" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    deps: {
      // See: https://vitest.dev/config/#deps-inline
      inline: ['@platformatic/ui-components']
    },
    globals: true,
    environment: 'happy-dom',
    exclude: ['**/test/e2e/**', 'node_modules/**']
  }
})
