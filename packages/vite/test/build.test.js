import { fileURLToPath } from 'node:url'
import { internalServicesFiles, verifyBuild } from '../../cli/test/helper.js'

const viteFiles = ['services/frontend/dist/index.html', 'services/frontend/dist/assets/index-*.js']
const viteSSRFiles = [
  'services/frontend/client/dist/client/index.html',
  'services/frontend/client/dist/server/index.js'
]

const configurations = [
  { id: 'standalone', name: 'Vite (standalone)', files: [...viteFiles] },
  {
    id: 'composer-with-prefix',
    name: 'Vite (in composer with prefix)',
    files: [...viteFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-without-prefix',
    name: 'Vite (in composer without prefix)',
    files: [...viteFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Vite (in composer with autodetected prefix)',
    files: [...viteFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-custom-commands',
    name: 'Vite (in composer with prefix using custom commands)',
    files: [...viteFiles, ...internalServicesFiles]
  },
  { id: 'ssr-standalone', name: 'Vite SSR (standalone)', files: [...viteSSRFiles] },
  {
    id: 'ssr-with-prefix',
    name: 'Vite SSR (in composer with prefix)',
    files: [...viteSSRFiles, ...internalServicesFiles]
  },
  {
    id: 'ssr-without-prefix',
    name: 'Vite SSR (in composer without prefix)',
    files: [...viteSSRFiles, ...internalServicesFiles]
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Vite SSR (in composer with autodetected prefix)',
    files: [...viteSSRFiles, ...internalServicesFiles]
  },
  {
    id: 'ssr-custom-commands',
    name: 'Vite SSR (in composer with prefix using custom commands)',
    files: [...viteSSRFiles, ...internalServicesFiles]
  }
]

verifyBuild(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
