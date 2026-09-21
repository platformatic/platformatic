import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/nested/base/dir/',
  plugins: [nitro()],
  nitro: { serverDir: 'server', baseURL: '/nested/base/dir' },
  server: { allowedHosts: ['.plt.local'] }
})
