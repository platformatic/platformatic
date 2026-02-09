import { resolve } from 'node:path'
import {
  internalApplicationsFiles,
  setAdditionalDependencies,
  setFixturesDir,
  verifyBuildAndProductionMode,
  verifyFrontendAPIOnAutodetectedPrefix,
  verifyFrontendAPIOnPrefix,
  verifyFrontendAPIOnRoot,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyPlatformaticGateway,
  verifyPlatformaticService
} from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

const files = ['services/frontend/build/client/assets/entry.client-*.js']

const configurations = [
  {
    id: 'standalone',
    name: 'Remix (standalone)',
    files,
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-with-prefix',
    name: 'Remix (in composer with prefix)',
    files: [...files, ...internalApplicationsFiles],
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'composer-without-prefix',
    name: 'Remix (in composer without prefix)',
    files,
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Remix (in composer with autodetected prefix)',
    files,
    checks: [
      verifyFrontendOnAutodetectedPrefix,
      verifyFrontendAPIOnAutodetectedPrefix,
      verifyPlatformaticGateway,
      verifyPlatformaticService
    ],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'composer-custom-commands',
    name: 'Remix (in composer with prefix using custom commands)',
    files,
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  }
]

verifyBuildAndProductionMode(configurations)
