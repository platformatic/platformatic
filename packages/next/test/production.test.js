import { resolve } from 'node:path'
import {
  internalServicesFiles,
  isCIOnWindows,
  setFixturesDir,
  updateFile,
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
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const files = ['services/frontend/.next/server/app/index.html']
const filesSSR = ['services/frontend/.next/server/app/direct/route.js']

const configurations = [
  { id: 'standalone', name: 'Next.js (standalone)', files, checks: [verifyFrontendOnRoot], language: 'js', prefix: '' },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Next.js (in composer with prefix)',
    files: [...files, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'ts',
    prefix: ''
  },
  {
    id: 'composer-with-external-proxy',
    name: 'Next.js (in composer with external proxy)',
    files,
    checks: [verifyFrontendOnPrefixWithProxy, verifyPlatformaticComposerWithProxy, verifyPlatformaticServiceWithProxy],
    language: 'ts',
    prefix: '/frontend',
    async additionalSetup (root) {
      await updateFile(resolve(root, 'services/composer/platformatic.json'), contents => {
        const json = JSON.parse(contents)
        json.composer.services[1].proxy = { prefix: '/frontend' }
        return JSON.stringify(json, null, 2)
      })
    }
  },
  {
    id: 'composer-without-prefix',
    name: 'Next.js (in composer without prefix)',
    files,
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Next.js (in composer with autodetected prefix)',
    files,
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'server-side',
    name: 'Next.js RSC (in composer with prefix)',
    files: [...files, ...filesSSR],
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'composer-custom-commands',
    name: 'Next.js (in composer with prefix using custom commands)',
    files,
    checks: [verifyFrontendOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  }
]

verifyBuildAndProductionMode(configurations)
