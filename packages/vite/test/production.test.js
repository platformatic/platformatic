import { resolve } from 'node:path'
import {
  internalServicesFiles,
  isCIOnWindows,
  isWindows,
  setFixturesDir,
  verifyBuildAndProductionMode,
  verifyFrontendAPIOnPrefix,
  verifyFrontendAPIOnRoot,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyHTMLViaHTTP,
  verifyPlatformaticComposer,
  verifyPlatformaticService
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const files = ['services/frontend/dist/index.html', 'services/frontend/dist/assets/index-*.js']
const filesSSR = ['services/frontend/client/dist/client/index.html', 'services/frontend/client/dist/server/index.js']

function verifyFrontendWithBundleOnRoot (t, url) {
  return verifyHTMLViaHTTP(url, '/', [
    '<title>Vite App</title>',
    /<script type="module" crossorigin src="\/assets\/index-[a-z0-9-_]+.js"><\/script>/i
  ])
}

async function verifyFrontendWithBundleOnPrefix (t, url) {
  const ssgContents = [
    '<title>Vite App</title>',
    /<script type="module" crossorigin src="\/frontend\/assets\/index-[a-z0-9-_]+.js"><\/script>/i
  ]

  await verifyHTMLViaHTTP(url, '/frontend', ssgContents)
  await verifyHTMLViaHTTP(url, '/frontend/', ssgContents)
}

async function verifyFrontendWithBundleOnAutodetectedPrefix (t, url) {
  const ssgContents = [
    '<title>Vite App</title>',
    /<script type="module" crossorigin src="\/nested\/base\/dir\/assets\/index-[a-z0-9-_]+.js"><\/script>/i
  ]

  await verifyHTMLViaHTTP(url, '/nested/base/dir', ssgContents)
  await verifyHTMLViaHTTP(url, '/nested/base/dir/', ssgContents)
}

const configurations = [
  {
    id: 'standalone',
    name: 'Vite (standalone)',
    files,
    checks: [verifyFrontendWithBundleOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Vite (in composer with prefix)',
    files: [...files, ...internalServicesFiles],
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'composer-without-prefix',
    name: 'Vite (in composer without prefix)',
    files,
    checks: [verifyFrontendWithBundleOnRoot, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Vite (in composer with autodetected prefix)',
    files,
    checks: [verifyFrontendWithBundleOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    only: isCIOnWindows,
    id: 'composer-custom-commands',
    name: 'Vite (in composer with prefix using custom commands)',
    files,
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-standalone',
    name: 'Vite SSR (standalone)',
    files: filesSSR,
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-with-prefix',
    name: 'Vite SSR (in composer with prefix)',
    files: filesSSR,
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-without-prefix',
    name: 'Vite SSR (in composer without prefix)',
    files: filesSSR,
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-autodetect-prefix',
    name: 'Vite SSR (in composer with autodetected prefix)',
    files: filesSSR,
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-custom-commands',
    name: 'Vite SSR (in composer with prefix using custom commands)',
    files: filesSSR,
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  }
]

verifyBuildAndProductionMode(configurations)
