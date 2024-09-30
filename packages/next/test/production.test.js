import { fileURLToPath } from 'node:url'
import {
  internalServicesFiles,
  isCIOnWindows,
  verifyBuildAndProductionMode,
  verifyFrontendAPIOnPrefix,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnPrefixWithProxy,
  verifyFrontendOnRoot,
  verifyPlatformaticComposer,
  verifyPlatformaticComposerWithProxy,
  verifyPlatformaticService,
  verifyPlatformaticServiceWithProxy
} from '../../cli/test/helper.js'

process.setMaxListeners(100)

const nextFiles = ['services/frontend/.next//server/app/index.html']
const nextSSRFiles = ['services/frontend/.next/server/app/direct/route.js']

const configurations = [
  { id: 'standalone', name: 'Next.js (standalone)', files: [...nextFiles], checks: [verifyFrontendOnRoot] },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Next.js (in composer with prefix)',
    files: [...nextFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    only: isCIOnWindows,
    id: 'composer-with-external-proxy',
    name: 'Next.js (in composer with external procy)',
    files: [...nextFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefixWithProxy, verifyPlatformaticComposerWithProxy, verifyPlatformaticServiceWithProxy]
  },
  {
    id: 'composer-without-prefix',
    name: 'Next.js (in composer without prefix)',
    files: [...nextFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Next.js (in composer with autodetected prefix)',
    files: [...internalServicesFiles],
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'server-side',
    name: 'Next.js RSC (in composer with prefix)',
    files: [...nextFiles, ...nextSSRFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-custom-commands',
    name: 'Next.js (in composer with prefix using custom commands)',
    files: [...nextFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

verifyBuildAndProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
