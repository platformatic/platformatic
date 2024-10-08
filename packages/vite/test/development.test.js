import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  createRuntime,
  fixturesDir,
  setFixturesDir,
  setHMRTriggerFile,
  verifyHMR,
  verifyHTMLViaHTTP,
  verifyHTMLViaInject,
  verifyJSONViaHTTP,
  verifyJSONViaInject
} from '../../basic/test/helper.js'
import { safeRemove } from '../../utils/index.js'

process.setMaxListeners(100)

const packageRoot = resolve(import.meta.dirname, '..')

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.type) {
    case 'connected':
      resolveConnection()
      break
    case 'full-reload':
      resolveReload()
  }
}

// Make sure no temporary files exist after execution
test.afterEach(() => {
  return Promise.all([
    safeRemove(resolve(fixturesDir, 'tmp')),
    safeRemove(resolve(fixturesDir, 'services/backend/dist')),
    safeRemove(resolve(fixturesDir, 'services/composer/dist'))
  ])
})

// In this test there is purposely no platformatic.application.json file to see if we work without one
test('should detect and start a Vite application in development mode', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/standalone'))
  setHMRTriggerFile('services/frontend/main.js')

  const { url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>', '<script type="module" src="/main.js"></script>']

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHMR(url, '/', 'vite-hmr', websocketHMRHandler)
})

test('should detect and start a Vite application in development mode when exposed in a composer with a prefix', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/composer-with-prefix'))
  setHMRTriggerFile('services/frontend/main.js')

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>', '<script type="module" src="/frontend/main.js"></script>']

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/frontend', htmlContents)
  await verifyHMR(url, '/frontend/', 'vite-hmr', websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
})

test('should detect and start a Vite application in development mode when exposed in a composer without a prefix', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/composer-without-prefix'))
  setHMRTriggerFile('services/frontend/main.js')

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>', '<script type="module" src="/main.js"></script>']

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/', htmlContents)
  await verifyHMR(url, '/', 'vite-hmr', websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start a Vite application in development mode when exposed in a composer with a custom config and by autodetecting the prefix', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/composer-autodetect-prefix'))
  setHMRTriggerFile('services/frontend/main.js')

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>', '<script type="module" src="/nested/base/dir/main.js"></script>']

  await verifyHTMLViaHTTP(url, '/nested/base/dir/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/nested/base/dir', htmlContents)
  await verifyHMR(url, '/nested/base/dir/', 'vite-hmr', websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
})

test('should detect and start a Vite application in development mode when exposed in a composer with a prefix using custom commands', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/composer-custom-commands'))
  setHMRTriggerFile('services/frontend/main.js')

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>', '<script type="module" src="/frontend/main.js"></script>']

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/frontend', htmlContents)
  await verifyHMR(url, '/frontend/', 'vite-hmr', websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
})

test('should detect and start a Vite SSR application in development mode', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/ssr-standalone'))
  setHMRTriggerFile('services/frontend/client/index.js')

  const { url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>']

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHMR(url, '/', 'vite-hmr', websocketHMRHandler)
})

test('should detect and start a Vite SSR application in development mode when exposed in a composer with a prefix', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/ssr-with-prefix'))
  setHMRTriggerFile('services/frontend/client/index.js')

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>', /Hello from v\d+ t\d+/]

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

test('should detect and start a Vite SSR application in development mode when exposed in a composer without a prefix', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/ssr-without-prefix'))
  setHMRTriggerFile('services/frontend/client/index.js')

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>', /Hello from v\d+ t\d+/]

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
test('should detect and start a Vite SSR application in development mode when exposed in a composer with a custom config and by autodetecting the prefix', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/ssr-autodetect-prefix'))
  setHMRTriggerFile('services/frontend/client/index.js')

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>', /Hello from v\d+ t\d+/]

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

test('should detect and start a Vite SSR application in development mode when exposed in a composer with a prefix using custom commands', async t => {
  setFixturesDir(resolve(import.meta.dirname, './fixtures/ssr-custom-commands'))
  setHMRTriggerFile('services/frontend/client/index.js')

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  const htmlContents = ['<title>Vite App</title>', /Hello from v\d+ t\d+/]

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
