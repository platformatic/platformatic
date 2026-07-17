import { deepStrictEqual, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  buildRuntime,
  prepareRuntime,
  setAdditionalDependencies,
  setFixturesDir,
  startRuntime,
  verifyBuildAndProductionMode,
  verifyHTMLViaHTTP,
  verifyHTMLViaInject,
  verifyJSONViaHTTP,
  verifyJSONViaInject,
  verifyPlatformaticGateway,
  verifyPlatformaticService
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(['nitro', 'nitropack', 'vite'])

const environmentKeys = [
  'HOST',
  'NITRO_HOST',
  'PORT',
  'NITRO_PORT',
  'NITRO_SHUTDOWN_DISABLED',
  'NITRO_SHUTDOWN_FORCE',
  'NITRO_SHUTDOWN_NO_FORCE_EXIT'
]

function verifyPage (contents, apiPath, apiBody) {
  return async function (_, url) {
    await verifyHTMLViaHTTP(url, '/', contents)
    if (apiPath) {
      await verifyJSONViaHTTP(url, apiPath, 200, apiBody)
    }
  }
}

async function verifyPrefix (_, url, runtime) {
  await verifyHTMLViaHTTP(url, '/frontend/', ['Hello from prefixed Nitro'])
  await verifyHTMLViaInject(runtime, 'composer', '/frontend', ['Hello from prefixed Nitro'])
  await verifyJSONViaHTTP(url, '/frontend/api/hello', 200, { hello: 'prefixed-nitro' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/api/hello', 200, { hello: 'prefixed-nitro' })
}

function verifyViteComposer (prefix) {
  return async function (_, url, runtime) {
    const pagePath = prefix ? `${prefix}/` : '/'
    const apiPath = `${prefix}/api/hello`

    await verifyHTMLViaHTTP(url, pagePath, ['<title>Nitro Vite</title>'])
    await verifyHTMLViaInject(runtime, 'composer', prefix || '/', ['<title>Nitro Vite</title>'])
    await verifyJSONViaHTTP(url, apiPath, 200, { hello: 'nitro-vite' })
    await verifyJSONViaInject(runtime, 'frontend', 'GET', apiPath, 200, { hello: 'nitro-vite' })
  }
}

verifyBuildAndProductionMode([
  {
    id: 'standalone',
    files: ['services/frontend/.output/server/index.mjs', 'services/frontend/.output/.platformatic-build.json'],
    checks: [verifyPage(['<title>Nitro Vite</title>'], '/api/hello', { hello: 'nitro-vite' })],
    language: 'js',
    prefix: ''
  },
  {
    id: 'vite-custom-output',
    files: ['services/frontend/custom/server/index.mjs', 'services/frontend/custom/.platformatic-build.json'],
    checks: [verifyPage(['<title>Nitro Vite Custom Output</title>'], '/api/hello', { hello: 'nitro-vite' })],
    language: 'js',
    prefix: ''
  },
  {
    id: 'standalone-nitro',
    files: ['services/frontend/.output/server/index.mjs'],
    checks: [verifyPage(['Hello from Nitro'], '/api/hello', { hello: 'nitropack' })],
    language: 'js',
    prefix: ''
  },
  {
    id: 'standalone-nitro-v3',
    files: ['services/frontend/.output/server/index.mjs'],
    checks: [verifyPage(['Hello from Nitro 3'], '/api/hello', { hello: 'nitro' })],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-with-prefix',
    files: ['services/frontend/.output/server/index.mjs'],
    checks: [verifyPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'composer-without-prefix',
    files: ['services/frontend/.output/server/index.mjs', 'services/frontend/.output/.platformatic-build.json'],
    checks: [verifyViteComposer(''), verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-autodetect-prefix',
    files: ['services/frontend/.output/server/index.mjs', 'services/frontend/.output/.platformatic-build.json'],
    checks: [verifyViteComposer('/nested/base/dir'), verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'composer-custom-commands',
    files: ['services/frontend/.output/server/index.mjs'],
    checks: [verifyViteComposer('/frontend'), verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'custom-output',
    files: ['services/frontend/build/server/index.mjs'],
    checks: [verifyPage(['Custom Nitro output'])],
    language: 'js',
    prefix: ''
  }
])

for (const fixture of ['standalone', 'standalone-nitro']) {
  test(`${fixture} production injection preserves the environment`, async t => {
    const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]))
    const sentinels = Object.fromEntries(environmentKeys.map(key => [key, `sentinel-${key.toLowerCase()}`]))
    Object.assign(process.env, sentinels)

    t.after(() => {
      for (const key of environmentKeys) {
        if (originalEnvironment[key] === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = originalEnvironment[key]
        }
      }
    })

    const { runtime, root } = await prepareRuntime(t, fixture, true)
    await buildRuntime(root)
    await startRuntime(t, runtime)
    const payload = { hello: 'injected Nitro' }
    const response = await runtime.inject('frontend', {
      method: 'POST',
      url: '/api/inspect',
      headers: {
        'content-type': 'application/json',
        'x-inspect': 'injected header'
      },
      body: payload
    })

    strictEqual(response.statusCode, 200)
    deepStrictEqual(JSON.parse(response.body), {
      body: payload,
      environment: sentinels,
      header: 'injected header'
    })

    for (const key of environmentKeys) {
      strictEqual(process.env[key], sentinels[key])
    }
  })
}
