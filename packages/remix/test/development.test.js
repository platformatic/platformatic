import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  createRuntime,
  setAdditionalDependencies,
  setFixturesDir,
  setHMRTriggerFile,
  verifyHMR,
  verifyHTMLViaHTTP,
  verifyHTMLViaInject,
  verifyJSONViaHTTP,
  verifyJSONViaInject
} from '../../basic/test/helper.js'

import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)

setHMRTriggerFile('services/frontend/app/root.jsx')
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.type) {
    case 'connected':
      resolveConnection()
      break
    case 'full-reload':
      resolveReload()
  }
}

// In this test there is purposely no platformatic.application.json file to see if we work without one
test('should detect and start a Remix application in development mode', async t => {
  const { url } = await createRuntime(t, 'standalone')

  const htmlContents = [/Hello from v<!-- -->\d+/, 'window.__remixRouteModules']

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHMR(url, '/', 'vite-hmr', websocketHMRHandler)
})

test('should detect and start a Remix application in development mode when exposed in a composer with a prefix', async t => {
  const { runtime, url } = await createRuntime(t, 'composer-with-prefix')

  const htmlContents = [/Hello from v<!-- -->\d+<!-- --> t<!-- -->\d+/, 'window.__remixRouteModules']

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/frontend', htmlContents)
  await verifyHMR(url, '/frontend/', 'vite-hmr', websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })
})

test('should detect and start a Remix application in development mode when exposed in a composer without a prefix', async t => {
  const { runtime, url } = await createRuntime(t, 'composer-without-prefix')

  const htmlContents = [/Hello from v<!-- -->\d+<!-- --> t<!-- -->\d+/, 'window.__remixRouteModules']

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/', htmlContents)
  await verifyHMR(url, '/', 'vite-hmr', websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start a Remix application in development mode when exposed in a composer with a custom config and by autodetecting the prefix', async t => {
  const { runtime, url } = await createRuntime(t, 'composer-autodetect-prefix')

  const htmlContents = [/Hello from v<!-- -->\d+<!-- --> t<!-- -->\d+/, 'window.__remixRouteModules']

  await verifyHTMLViaHTTP(url, '/nested/base/dir/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/nested/base/dir', htmlContents)
  await verifyHMR(url, '/nested/base/dir/', 'vite-hmr', websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })
})

test('should detect and start a Remix application in development mode when exposed in a composer with a prefix using custom commands', async t => {
  const { runtime, url } = await createRuntime(t, 'composer-custom-commands')

  const htmlContents = [/Hello from v<!-- -->\d+<!-- --> t<!-- -->\d+/, 'window.__remixRouteModules']

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/frontend', htmlContents)
  await verifyHMR(url, '/frontend/', 'vite-hmr', websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })
})
