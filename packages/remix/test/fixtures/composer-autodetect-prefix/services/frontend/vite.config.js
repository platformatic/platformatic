import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/nested/base/dir/',
  plugins: [remix({ basename: '/nested/base/dir/' })]
})
