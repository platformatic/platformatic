import { resolve } from 'node:path'
import {
  internalApplicationsFiles,
  setAdditionalDependencies,
  setFixturesDir,
  verifyBuildAndProductionMode,
  verifyHTMLViaHTTP,
  verifyPlatformaticGateway,
  verifyPlatformaticService
} from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

const files = ['services/frontend/build/client/assets/entry.client-*.js']

function verifyFrontendWithBundleOnRoot (_, url) {
  return verifyHTMLViaHTTP(url, '/', [/import\("\/assets\/entry\.client-.+\.js"\)/])
}

async function verifyFrontendWithBundleOnPrefix (t, url) {
  const ssgContents = [/import\("\/frontend\/assets\/entry\.client-.+\.js"\)/]

  await verifyHTMLViaHTTP(url, '/frontend', ssgContents)
  await verifyHTMLViaHTTP(url, '/frontend/', ssgContents)
}

async function verifyFrontendWithBundleOnAutodetectedPrefix (t, url) {
  const ssgContents = [/import\("\/nested\/base\/dir\/assets\/entry\.client-.+\.js"\)/]

  await verifyHTMLViaHTTP(url, '/nested/base/dir', ssgContents)
  await verifyHTMLViaHTTP(url, '/nested/base/dir/', ssgContents)
}

const configurations = [
  {
    id: 'standalone',
    name: 'React Router (standalone)',
    files,
    checks: [verifyFrontendWithBundleOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-with-prefix',
    name: 'React Router (in composer with prefix)',
    files: [...files, ...internalApplicationsFiles],
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'composer-without-prefix',
    name: 'React Router (in composer without prefix)',
    files,
    checks: [verifyFrontendWithBundleOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'React Router (in composer with autodetected prefix)',
    files,
    checks: [verifyFrontendWithBundleOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'composer-custom-commands',
    name: 'React Router (in composer with prefix using custom commands)',
    files,
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'ssr-standalone',
    name: 'React Router SSR (standalone)',
    files,
    checks: [verifyFrontendWithBundleOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    id: 'ssr-composer-with-prefix',
    name: 'React Router SSR (in composer with prefix)',
    files: [...files, ...internalApplicationsFiles],
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'ssr-composer-without-prefix',
    name: 'React Router SSR (in composer without prefix)',
    files,
    checks: [verifyFrontendWithBundleOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'ssr-composer-autodetect-prefix',
    name: 'React Router SSR (in composer with autodetected prefix)',
    files,
    checks: [verifyFrontendWithBundleOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'ssr-composer-custom-commands',
    name: 'React Router SSR (in composer with prefix using custom commands)',
    files,
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  }
]

verifyBuildAndProductionMode(configurations)
