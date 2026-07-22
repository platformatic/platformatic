import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/frontend/',
  plugins: [nitro()],
  nitro: { serverDir: 'server', baseURL: '/frontend' },
  server: { allowedHosts: ['.plt.local'] }
})
