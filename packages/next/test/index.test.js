import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import {
  createRuntime,
  fixturesDir,
  setFixturesDir,
  updateHMRVersion,
  verifyHMR,
  verifyHTMLViaHTTP,
  verifyHTMLViaInject,
  verifyJSONViaHTTP,
  verifyJSONViaInject,
} from '../../basic/test/helper.js'
import { safeRemove } from '../../utils/index.js'

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.action) {
    case 'sync':
      resolveConnection()
      break
    case 'serverComponentChanges':
      resolveReload()
  }
}

function cleanNext (configFile) {
  const root = dirname(resolve(fixturesDir, configFile))
  return safeRemove(resolve(root, '.next'))
}

const packageRoot = resolve(import.meta.dirname, '..')
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('can detect and start a Next application', async t => {
  await updateHMRVersion()
  await cleanNext('next/standalone/platformatic.runtime.json')

  const { url } = await createRuntime(t, 'next/standalone/platformatic.runtime.json', packageRoot)

  await verifyHTMLViaHTTP(url, '/', ['<script src="/_next/static/chunks/main-app.js'])
  await verifyHMR(url, '/_next/webpack-hmr', undefined, websocketHMRHandler)
})

test('can detect and start a Next application when exposed in a composer with a prefix', async t => {
  await updateHMRVersion()
  await cleanNext('next/composer-with-prefix/platformatic.runtime.json')

  const { runtime, url } = await createRuntime(t, 'next/composer-with-prefix/platformatic.runtime.json', packageRoot)

  const htmlContents = ['<script src="/frontend/_next/static/chunks/main-app.js']

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'main', '/frontend', htmlContents)
  await verifyHMR(url, '/frontend/_next/webpack-hmr', undefined, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
})

test('can detect and start a Next application when exposed in a composer without a prefix', async t => {
  await updateHMRVersion()
  await cleanNext('next/composer-without-prefix/platformatic.runtime.json')

  const { runtime, url } = await createRuntime(t, 'next/composer-without-prefix/platformatic.runtime.json', packageRoot)

  const htmlContents = ['<script src="/_next/static/chunks/main-app.js']

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHTMLViaInject(runtime, 'main', '/', htmlContents)
  await verifyHMR(url, '/_next/webpack-hmr', undefined, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
})

// In this file the application purposely does not specify a platformatic.application.json to see if we automatically detect one
test('can detect and start a Next application when exposed in a composer with a custom config and by autodetecting the prefix', async t => {
  await updateHMRVersion()
  await cleanNext('next/composer-autodetect-prefix/platformatic.runtime.json')

  const { runtime, url } = await createRuntime(
    t,
    'next/composer-autodetect-prefix/platformatic.runtime.json',
    packageRoot
  )

  const htmlContents = ['<script src="/nested/base/dir/_next/static/chunks/main-app.js']

  await verifyHTMLViaHTTP(url, '/nested/base/dir/', htmlContents)
  await verifyHTMLViaInject(runtime, 'main', '/nested/base/dir', htmlContents)
  await verifyHMR(url, '/nested/base/dir/_next/webpack-hmr', undefined, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
})

test('can detect and start a Next application with working React Server Components and Next server API', async t => {
  await updateHMRVersion()
  await cleanNext('next/server-side/platformatic.runtime.json')
  const { runtime, url } = await createRuntime(t, 'next/server-side/platformatic.runtime.json', packageRoot)

  const htmlContents = ['<script src="/frontend/_next/static/chunks/main-app.js']

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'main', '/frontend', htmlContents)
  await verifyHMR(url, '/frontend/_next/webpack-hmr', undefined, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'service', 'GET', '/mesh', 200, { ok: true })
})
