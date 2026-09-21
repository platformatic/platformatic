import { resolve } from 'node:path'
import {
  internalApplicationsFiles,
  setAdditionalDependencies,
  setFixturesDir,
  verifyBuildAndProductionMode,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyHTMLViaHTTP,
  verifyPlatformaticGateway,
  verifyPlatformaticService,
} from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

const files = ['services/frontend/.output/server/index.mjs']

const htmlContents = ['<script>window.__NUXT__={}']

function verifyStandalone (_, url) {
  return verifyHTMLViaHTTP(url, '/', [htmlContents])
}

async function verifyComposerOnPrefix (_, url) {
  await verifyHTMLViaHTTP(url, '/frontend', [htmlContents])
  await verifyHTMLViaHTTP(url, '/frontend/', [htmlContents])
}

async function verifyComposerOnAutodetectedPrefix (_, url) {
  await verifyHTMLViaHTTP(url, '/nested/base/dir', [htmlContents])
  await verifyHTMLViaHTTP(url, '/nested/base/dir/', [htmlContents])
}

const configurations = [
  {
    id: 'standalone',
    name: 'Nuxt (standalone)',
    files,
    checks: [verifyStandalone],
    language: 'js',
    prefix: '',
  },
  {
    id: 'composer-with-prefix',
    name: 'Nuxt (in composer with prefix)',
    files: [...files, ...internalApplicationsFiles],
    checks: [
      verifyComposerOnPrefix,
      verifyPlatformaticGateway,
      verifyPlatformaticService,
    ],
    language: 'ts',
    prefix: '/frontend',
  },
  {
    id: 'composer-without-prefix',
    name: 'Nuxt (in composer without prefix)',
    files,
    checks: [
      verifyStandalone,
      verifyPlatformaticGateway,
      verifyPlatformaticService,
    ],
    language: 'js',
    prefix: '',
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Nuxt (in composer with autodetected prefix)',
    files,
    checks: [
      verifyComposerOnAutodetectedPrefix,
      verifyPlatformaticGateway,
      verifyPlatformaticService,
    ],
    language: 'js',
    prefix: '/nested/base/dir',
  },
  {
    id: 'composer-custom-commands',
    name: 'Nuxt (in composer with prefix using custom commands)',
    files,
    checks: [
      verifyComposerOnPrefix,
      verifyPlatformaticGateway,
      verifyPlatformaticService,
    ],
    language: 'js',
    prefix: '/frontend',
  },
  {
    id: 'ssr-standalone',
    name: 'Nuxt SSR (standalone)',
    files,
    checks: [verifyFrontendOnRoot],
    language: 'js',
    prefix: '',
  },
  {
    id: 'ssr-with-prefix',
    name: 'Nuxt SSR (in composer with prefix)',
    files: [...files, ...internalApplicationsFiles],
    checks: [
      verifyFrontendOnPrefix,
      verifyPlatformaticGateway,
      verifyPlatformaticService,
    ],
    language: 'ts',
    prefix: '/frontend',
  },
  {
    id: 'ssr-without-prefix',
    name: 'Nuxt SSR (in composer without prefix)',
    files,
    checks: [
      verifyFrontendOnRoot,
      verifyPlatformaticGateway,
      verifyPlatformaticService,
    ],
    language: 'js',
    prefix: '',
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Nuxt SSR (in composer with autodetected prefix)',
    files,
    checks: [
      verifyFrontendOnAutodetectedPrefix,
      verifyPlatformaticGateway,
      verifyPlatformaticService,
    ],
    language: 'js',
    prefix: '/nested/base/dir',
  },
  {
    id: 'ssr-custom-commands',
    name: 'Nuxt SSR (in composer with prefix using custom commands)',
    files,
    checks: [
      verifyFrontendOnPrefix,
      verifyPlatformaticGateway,
      verifyPlatformaticService,
    ],
    language: 'js',
    prefix: '/frontend',
  },
]

verifyBuildAndProductionMode(configurations)
