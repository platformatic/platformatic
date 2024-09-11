import { fileURLToPath } from 'node:url'
import { internalServicesFiles, isCIOnWindows, verifyBuild } from '../../cli/test/helper.js'

const astroFiles = ['services/frontend/dist/index.html']
const astroSSRFiles = ['services/frontend/dist/server/entry.mjs']

const configurations = [
  { id: 'standalone', name: 'Astro (standalone)', files: [...astroFiles] },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Astro (in composer with prefix)',
    files: [...astroFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-without-prefix',
    name: 'Astro (in composer without prefix)',
    files: [...astroFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Astro (in composer with autodetected prefix)',
    files: [...astroFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-custom-commands',
    name: 'Astro (in composer with prefix using custom commands)',
    files: [...astroFiles, ...internalServicesFiles]
  },
  { id: 'ssr-standalone', name: 'Astro SSR (standalone)', files: [...astroSSRFiles] },
  {
    only: isCIOnWindows,
    id: 'ssr-with-prefix',
    name: 'Astro SSR (in composer with prefix)',
    files: [...astroSSRFiles, ...internalServicesFiles]
  },
  {
    id: 'ssr-without-prefix',
    name: 'Astro SSR (in composer without prefix)',
    files: [...astroSSRFiles, ...internalServicesFiles]
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Astro SSR (in composer with autodetected prefix)',
    files: [...astroSSRFiles, ...internalServicesFiles]
  },
  {
    id: 'ssr-custom-commands',
    name: 'Astro SSR (in composer with prefix using custom commands)',
    files: [...astroSSRFiles, ...internalServicesFiles]
  }
]

verifyBuild(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
