import { fileURLToPath } from 'node:url'
import {
  internalServicesFiles,
  isCIOnWindows,
  verifyBuildAndProductionMode,
  verifyFrontendAPIOnPrefix,
  verifyFrontendAPIOnRoot,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyPlatformaticComposer,
  verifyPlatformaticService
} from '../../cli/test/helper.js'

process.setMaxListeners(100)

const astroFiles = ['services/frontend/dist/index.html']
const astroSSRFiles = ['services/frontend/dist/server/entry.mjs']

const configurations = [
  {
    id: 'standalone',
    name: 'Astro (standalone)',
    files: [...astroFiles],
    checks: [verifyFrontendOnRoot]
  },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Astro (in composer with prefix)',
    files: [...astroFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-without-prefix',
    name: 'Astro (in composer without prefix)',
    files: [...astroFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Astro (in composer with autodetected prefix)',
    files: [...astroFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-custom-commands',
    name: 'Astro (in composer with prefix using custom commands)',
    files: [...astroFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-standalone',
    name: 'Astro SSR (standalone)',
    files: [...astroSSRFiles],
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot]
  },
  {
    only: isCIOnWindows,
    id: 'ssr-with-prefix',
    name: 'Astro SSR (in composer with prefix)',
    files: [...astroSSRFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-without-prefix',
    name: 'Astro SSR (in composer without prefix)',
    files: [...astroSSRFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Astro SSR (in composer with autodetected prefix)',
    files: [...astroSSRFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-custom-commands',
    name: 'Astro SSR (in composer with autodetected prefix using custom commands)',
    files: [...astroSSRFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

verifyBuildAndProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations, true)
