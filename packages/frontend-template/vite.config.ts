import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // This is needed for GitHub actions due to https://github.com/vitejs/vite/issues/10802
  resolve: {
    preserveSymlinks: true
  }
})
