import { fileURLToPath } from 'node:url'
import {
  isCIOnWindows,
  verifyFrontendAPIOnAutodetectedPrefix,
  verifyFrontendAPIOnPrefix,
  verifyFrontendAPIOnRoot,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyPlatformaticComposer,
  verifyPlatformaticService,
  verifyProductionMode
} from '../../cli/test/helper.js'

const configurations = [
  { id: 'standalone', name: 'Remix (standalone)', checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot] },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Remix (in composer with prefix)',
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-without-prefix',
    name: 'Remix (in composer without prefix)',
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Remix (in composer with autodetected prefix)',
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
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

verifyProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
