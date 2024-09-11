import { fileURLToPath } from 'node:url'
import {
  verifyFrontendAPIOnPrefix,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyPlatformaticComposer,
  verifyPlatformaticService,
  verifyProductionMode
} from '../../cli/test/helper.js'

const configurations = [
  { id: 'standalone', name: 'Next.js (standalone)', checks: [verifyFrontendOnRoot] },
  {
    id: 'composer-with-prefix',
    name: 'Next.js (in composer with prefix)',
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-without-prefix',
    name: 'Next.js (in composer without prefix)',
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Next.js (in composer with autodetected prefix)',
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'server-side',
    name: 'Next.js RSC (in composer with prefix)',
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-custom-commands',
    name: 'Next.js (in composer with prefix using custom commands)',
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

verifyProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
