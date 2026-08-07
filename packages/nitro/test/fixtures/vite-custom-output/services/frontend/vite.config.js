import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [nitro()],
  nitro: {
    serverDir: 'server',
    output: { dir: 'custom' }
  }
})
