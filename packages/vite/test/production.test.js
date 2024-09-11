import { fileURLToPath } from 'node:url'
import { verifyHTMLViaHTTP } from '../../basic/test/helper.js'
import {
  isCIOnWindows,
  verifyFrontendAPIOnPrefix,
  verifyFrontendAPIOnRoot,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyPlatformaticComposer,
  verifyPlatformaticService,
  verifyProductionMode
} from '../../cli/test/helper.js'

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
  { id: 'standalone', name: 'Vite (standalone)', checks: [verifyFrontendWithBundleOnRoot] },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Vite (in composer with prefix)',
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-without-prefix',
    name: 'Vite (in composer without prefix)',
    checks: [verifyFrontendWithBundleOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Vite (in composer with autodetected prefix)',
    checks: [verifyFrontendWithBundleOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'composer-custom-commands',
    name: 'Vite (in composer with prefix using custom commands)',
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-standalone',
    name: 'Vite SSR (standalone)',
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot]
  },
  {
    only: isCIOnWindows,
    id: 'ssr-with-prefix',
    name: 'Vite SSR (in composer with prefix)',
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-without-prefix',
    name: 'Vite SSR (in composer without prefix)',
    checks: [verifyFrontendOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Vite SSR (in composer with autodetected prefix)',
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'ssr-custom-commands',
    name: 'Vite SSR (in composer with prefix using custom commands)',
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

verifyProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
