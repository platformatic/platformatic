import { test } from 'node:test'
import {
  createRuntime,
  updateHMRVersion,
  verifyHMR,
  verifyHTMLViaHTTP,
  verifyHTMLViaInject,
  verifyJSONViaHTTP,
  verifyJSONViaInject,
} from './helper.js'

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.action) {
    case 'sync':
      resolveConnection()
      break
    case 'serverComponentChanges':
      resolveReload()
  }
}

test('can detect and start a Next application', async t => {
  const versionFile = await updateHMRVersion()
  const { url } = await createRuntime(t, 'next/standalone/platformatic.runtime.json')

  await verifyHTMLViaHTTP(url, '/', ['<script src="/_next/static/chunks/main-app.js'])
  await verifyHMR(url, '/_next/webpack-hmr', versionFile, undefined, websocketHMRHandler)
})

test('can detect and start a Next application when exposed in a composer with a prefix', async t => {
  const versionFile = await updateHMRVersion()
  const { runtime, url } = await createRuntime(t, 'next/composer-with-prefix/platformatic.runtime.json')

  const htmlContents = ['<script src="/frontend/_next/static/chunks/main-app.js']

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'main', '/frontend', htmlContents)
  await verifyHMR(url, '/frontend/_next/webpack-hmr', versionFile, undefined, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
})

test('can detect and start a Next application when exposed in a composer without a prefix', async t => {
  const versionFile = await updateHMRVersion()
  const { runtime, url } = await createRuntime(t, 'next/composer-without-prefix/platformatic.runtime.json')

  const htmlContents = ['<script src="/_next/static/chunks/main-app.js']

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHTMLViaInject(runtime, 'main', '/', htmlContents)
  await verifyHMR(url, '/_next/webpack-hmr', versionFile, undefined, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
})

test('can detect and start a Next application when exposed in a composer with a custom config and by autodetecting the prefix', async t => {
  const versionFile = await updateHMRVersion()
  const { runtime, url } = await createRuntime(t, 'next/composer-autodetect-prefix/platformatic.runtime.json')

  const htmlContents = ['<script src="/nested/base/dir/_next/static/chunks/main-app.js']

  await verifyHTMLViaHTTP(url, '/nested/base/dir/', htmlContents)
  await verifyHTMLViaInject(runtime, 'main', '/nested/base/dir', htmlContents)
  await verifyHMR(url, '/nested/base/dir/_next/webpack-hmr', versionFile, undefined, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
})
