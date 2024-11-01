import { fileURLToPath } from 'node:url'
import { setAdditionalDependencies } from '../../basic/test/helper.js'
import {
  internalServicesFiles,
  isCIOnWindows,
  verifyBuildAndProductionMode,
  verifyFrontendAPIOnAutodetectedPrefix,
  verifyFrontendAPIOnPrefix,
  verifyFrontendAPIOnRoot,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyPlatformaticComposer,
  verifyPlatformaticService
} from '../../cli/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)

const remixFiles = ['services/frontend/build/client/assets/entry.client-*.js']

const configurations = [
  {
    id: 'standalone',
    name: 'Remix (standalone)',
    files: [...remixFiles],
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot]
  },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Remix (in composer with prefix)',
    files: [...remixFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-without-prefix',
    name: 'Remix (in composer without prefix)',
    files: [...remixFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Remix (in composer with autodetected prefix)',
    files: [...remixFiles, ...internalServicesFiles],
    checks: [
      verifyFrontendOnAutodetectedPrefix,
      verifyFrontendAPIOnAutodetectedPrefix,
      verifyPlatformaticComposer,
      verifyPlatformaticService
    ]
  },
  {
    id: 'composer-custom-commands',
    name: 'Remix (in composer with prefix using custom commands)',
    files: [...remixFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

setAdditionalDependencies(additionalDependencies)

verifyBuildAndProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
