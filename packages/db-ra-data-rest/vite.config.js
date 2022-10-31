import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      name: 'db-ra-data-rest',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'styled-components']
    }
  }
})
