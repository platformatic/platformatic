import { fileURLToPath } from 'node:url'
import {
  isCIOnWindows,
  verifyFrontendAPIOnPrefix,
  verifyFrontendAPIOnRoot,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyPlatformaticComposer,
  verifyPlatformaticService,
  verifyProductionMode
} from '../../cli/test/helper.js'

process.setMaxListeners(100)

const configurations = [
  {
    id: 'standalone',
    name: 'Astro (standalone)',
    checks: [verifyFrontendOnRoot]
  },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Astro (in composer with prefix)',
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-without-prefix',
    name: 'Astro (in composer without prefix)',
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Astro (in composer with autodetected prefix)',
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-custom-commands',
    name: 'Astro (in composer with prefix using custom commands)',
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-standalone',
    name: 'Astro SSR (standalone)',
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot]
  },
  {
    only: isCIOnWindows,
    id: 'ssr-with-prefix',
    name: 'Astro SSR (in composer with prefix)',
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-without-prefix',
    name: 'Astro SSR (in composer without prefix)',
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Astro SSR (in composer with autodetected prefix)',
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-custom-commands',
    name: 'Astro SSR (in composer with autodetected prefix using custom commands)',
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

verifyProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
