import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { request } from 'undici'
import {
  setFixturesDir,
  verifyBuildAndProductionMode,
  verifyHTMLViaHTTP,
  verifyPlatformaticGateway,
  verifyPlatformaticService
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const filesAppRouter = ['services/frontend/dist/server/index.js', 'services/frontend/dist/client/assets/*.js']
const filesPagesRouter = ['services/frontend/dist/server/entry.js', 'services/frontend/dist/client/assets/*.js']

function verifyFrontendWithBundleOnRoot (t, url) {
  return verifyHTMLViaHTTP(url, '/', [
    'self.__VINEXT_RSC_PARAMS',
    /<script id="_R_">import\("\/assets\/index-[a-z0-9-_]+.js"\)<\/script>/i
  ])
}

async function verifyFrontendPagesOnRoot (t, url) {
  const { statusCode, headers, body } = await request(url + '/')
  deepStrictEqual(statusCode, 200)

  const contentType = Array.isArray(headers['content-type']) ? headers['content-type'][0] : headers['content-type']

  ok(contentType?.startsWith('text/html'))

  const html = await body.text()
  ok(/Hello from v(?:<!-- -->)?\d+/.test(html))
}

async function verifyFrontendWithBundleOnPrefix (t, url) {
  const ssgContents = [
    'self.__VINEXT_RSC_PARAMS',
    /<script id="_R_">import\("\/frontend\/assets\/index-[a-z0-9-_]+.js"\)<\/script>/i
  ]

  await verifyHTMLViaHTTP(url, '/frontend', ssgContents)
  await verifyHTMLViaHTTP(url, '/frontend/', ssgContents)
}

async function verifyFrontendWithBundleOnAutodetectedPrefix (t, url) {
  const ssgContents = [
    'self.__VINEXT_RSC_PARAMS',
    /<script id="_R_">import\("\/nested\/base\/dir\/assets\/index-[a-z0-9-_]+.js"\)<\/script>/i
  ]

  await verifyHTMLViaHTTP(url, '/nested/base/dir', ssgContents)
  await verifyHTMLViaHTTP(url, '/nested/base/dir/', ssgContents)
}

const configurations = [
  {
    id: 'standalone',
    name: 'Vinext (standalone)',
    files: filesAppRouter,
    checks: [verifyFrontendWithBundleOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-with-prefix',
    name: 'Vinext (in composer with prefix)',
    files: filesAppRouter,
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'composer-without-prefix',
    name: 'Vinext (in composer without prefix)',
    files: filesPagesRouter,
    checks: [verifyFrontendPagesOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Vinext (in composer with autodetected prefix)',
    files: filesAppRouter,
    checks: [verifyFrontendWithBundleOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'composer-custom-commands',
    name: 'Vinext (in composer with prefix using custom commands)',
    files: filesAppRouter,
    checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  }
]

verifyBuildAndProductionMode(configurations)
