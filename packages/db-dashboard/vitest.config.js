/// <reference types="vitest" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['**/test/e2e/**', 'node_modules/**', 'src/components/Header.test.jsx']
  }
})
