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
  verifyPlatformaticService
} from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

const files = ['services/frontend/dist/server/index.mjs']

function verifyFrontendWithBundleOnRoot (t, url) {
  return verifyHTMLViaHTTP(url, '/', '<!--$--><!--$--><!--/$-->')
}

async function verifyFrontendWithBundleOnPrefix (t, url) {
  const ssgContents = '<!--$--><!--$--><!--/$-->'

  await verifyHTMLViaHTTP(url, '/frontend', ssgContents)
  await verifyHTMLViaHTTP(url, '/frontend/', ssgContents)
}

async function verifyFrontendWithBundleOnAutodetectedPrefix (t, url) {
  const ssgContents = '<!--$--><!--$--><!--/$-->'

  await verifyHTMLViaHTTP(url, '/nested/base/dir', ssgContents)
  await verifyHTMLViaHTTP(url, '/nested/base/dir/', ssgContents)
}

const configurations = [
  {
    id: 'standalone',
    name: 'Tanstack (standalone)',
    files,
    checks: [verifyFrontendWithBundleOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-with-prefix',
    name: 'Tanstack (in composer with prefix)',
    files: [...files, ...internalApplicationsFiles],
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'composer-without-prefix',
    name: 'Tanstack (in composer without prefix)',
    files,
    checks: [verifyFrontendWithBundleOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Tanstack (in composer with autodetected prefix)',
    files,
    checks: [verifyFrontendWithBundleOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'composer-custom-commands',
    name: 'Tanstack (in composer with prefix using custom commands)',
    files,
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'ssr-standalone',
    name: 'Tanstack SSR (standalone)',
    files,
    checks: [verifyFrontendOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    id: 'ssr-with-prefix',
    name: 'Tanstack SSR (in composer with prefix)',
    files: [...files, ...internalApplicationsFiles],
    checks: [verifyFrontendOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'ssr-without-prefix',
    name: 'Tanstack SSR (in composer without prefix)',
    files,
    checks: [verifyFrontendOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Tanstack SSR (in composer with autodetected prefix)',
    files,
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'ssr-custom-commands',
    name: 'Tanstack SSR (in composer with prefix using custom commands)',
    files,
    checks: [verifyFrontendOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  }
]

verifyBuildAndProductionMode(configurations)
