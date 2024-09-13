import { fileURLToPath } from 'node:url'
import { verifyHTMLViaHTTP } from '../../basic/test/helper.js'
import {
  internalServicesFiles,
  isCIOnWindows,
  isWindows,
  verifyBuildAndProductionMode,
  verifyFrontendAPIOnPrefix,
  verifyFrontendAPIOnRoot,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyPlatformaticComposer,
  verifyPlatformaticService
} from '../../cli/test/helper.js'

process.setMaxListeners(100)

const viteFiles = ['services/frontend/dist/index.html', 'services/frontend/dist/assets/index-*.js']
const viteSSRFiles = [
  'services/frontend/client/dist/client/index.html',
  'services/frontend/client/dist/server/index.js'
]

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
  { id: 'standalone', name: 'Vite (standalone)', files: [...viteFiles], checks: [verifyFrontendWithBundleOnRoot] },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Vite (in composer with prefix)',
    files: [...viteFiles, ...internalServicesFiles],
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-without-prefix',
    name: 'Vite (in composer without prefix)',
    files: [...viteFiles, ...internalServicesFiles],
    checks: [verifyFrontendWithBundleOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Vite (in composer with autodetected prefix)',
    files: [...viteFiles, ...internalServicesFiles],
    checks: [verifyFrontendWithBundleOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    only: isCIOnWindows,
    id: 'composer-custom-commands',
    name: 'Vite (in composer with prefix using custom commands)',
    files: [...viteFiles, ...internalServicesFiles],
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-standalone',
    name: 'Vite SSR (standalone)',
    files: [...viteSSRFiles],
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot]
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-with-prefix',
    name: 'Vite SSR (in composer with prefix)',
    files: [...viteSSRFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-without-prefix',
    name: 'Vite SSR (in composer without prefix)',
    files: [...viteSSRFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-autodetect-prefix',
    name: 'Vite SSR (in composer with autodetected prefix)',
    files: [...viteSSRFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    // Disabled on Windows due to https://github.com/fastify/fastify-vite/issues/162
    skip: isWindows,
    id: 'ssr-custom-commands',
    name: 'Vite SSR (in composer with prefix using custom commands)',
    files: [...viteSSRFiles, ...internalServicesFiles],
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

verifyBuildAndProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
