import { ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  createRuntime,
  fixturesDir,
  getLogs,
  setFixturesDir,
  verifyJSONViaHTTP,
  verifyJSONViaInject
} from '../../basic/test/helper.js'
import { safeRemove } from '../../utils/index.js'

process.setMaxListeners(100)
const packageRoot = resolve(import.meta.dirname, '..')

function isTime (body) {
  ok(typeof body.time === 'number')
}

async function verifyStandalone (t, configuration) {
  setFixturesDir(resolve(import.meta.dirname, `./fixtures/${configuration}`))

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  await verifyJSONViaHTTP(url, '/', 200, { production: false })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: false })

  return { runtime, url }
}

async function verifyComposerWithPrefix (t, configuration) {
  setFixturesDir(resolve(import.meta.dirname, `./fixtures/${configuration}`))

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  await verifyJSONViaHTTP(url, '/frontend', 200, { production: false })
  await verifyJSONViaHTTP(url, '/frontend/', 200, { production: false })
  await verifyJSONViaHTTP(url, '/frontend/time', 200, isTime)
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/frontend/', 200, { production: false })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/frontend/time', 200, isTime)
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })

  return { runtime, url }
}

async function verifyComposerWithoutPrefix (t, configuration) {
  setFixturesDir(resolve(import.meta.dirname, `./fixtures/${configuration}`))

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  await verifyJSONViaHTTP(url, '/', 200, { production: false })
  await verifyJSONViaHTTP(url, '/time', 200, isTime)
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: false })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/time', 200, isTime)
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })

  return { runtime, url }
}

async function verifyComposerAutodetectPrefix (t, configuration) {
  setFixturesDir(resolve(import.meta.dirname, `./fixtures/${configuration}`))

  const { runtime, url } = await createRuntime(t, 'platformatic.runtime.json', packageRoot)

  await verifyJSONViaHTTP(url, '/nested/base/dir', 200, { production: false })
  await verifyJSONViaHTTP(url, '/nested/base/dir/', 200, { production: false })
  await verifyJSONViaHTTP(url, '/nested/base/dir/time', 200, isTime)
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/nested/base/dir/', 200, { production: false })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/nested/base/dir/time', 200, isTime)
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })

  return { runtime, url }
}

// Make sure no temporary files exist after execution
test.afterEach(() => {
  return Promise.all([
    safeRemove(resolve(fixturesDir, 'node_modules')),
    safeRemove(resolve(fixturesDir, 'services/backend/dist')),
    safeRemove(resolve(fixturesDir, 'services/composer/dist')),
    safeRemove(resolve(fixturesDir, 'services/frontend/node_modules'))
  ])
})

test('should detect and start a Node.js application with no configuration files in development mode when standalone', async t => {
  const { runtime } = await verifyStandalone(t, 'node-no-configuration-standalone')

  const missingConfigurationMessage =
    'The service frontend had no valid entrypoint defined in the package.json file. Falling back to the file "index.mjs".'

  const logs = await getLogs(runtime)
  ok(logs.map(m => m.msg).includes(missingConfigurationMessage))
})

test('should detect and start a Node.js application with no configuration files in development mode when exposed in a composer with a prefix', async t => {
  const { runtime } = await verifyComposerWithPrefix(t, 'node-no-configuration-composer-with-prefix')

  const missingConfigurationMessage =
    'The service frontend had no valid entrypoint defined in the package.json file. Falling back to the file "index.mjs".'

  const logs = await getLogs(runtime)
  ok(logs.map(m => m.msg).includes(missingConfigurationMessage))
})

test('should detect and start a Node.js application with no configuration files in development mode when exposed in a composer without a prefix', async t => {
  const { runtime } = await verifyComposerWithoutPrefix(t, 'node-no-configuration-composer-without-prefix')

  const missingConfigurationMessage =
    'The service frontend had no valid entrypoint defined in the package.json file. Falling back to the file "index.mjs".'

  const logs = await getLogs(runtime)
  ok(logs.map(m => m.msg).includes(missingConfigurationMessage))
})

test('should detect and start a Node.js application with no configuration files in development mode when exposed in a composer by autodetecting the prefix', async t => {
  const { runtime } = await verifyComposerAutodetectPrefix(t, 'node-no-configuration-composer-autodetect-prefix')

  const missingConfigurationMessage =
    'The service frontend had no valid entrypoint defined in the package.json file. Falling back to the file "index.mjs".'

  const logs = await getLogs(runtime)
  ok(logs.map(m => m.msg).includes(missingConfigurationMessage))
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start a Node.js application with no build function in development mode when standalone', async t => {
  await verifyStandalone(t, 'node-no-build-standalone')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start a Node.js application with no build function in development mode when exposed in a composer with a prefix', async t => {
  await verifyComposerWithPrefix(t, 'node-no-build-composer-with-prefix')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start a Node.js application with no build function in development mode when exposed in a composer without a prefix', async t => {
  await verifyComposerWithoutPrefix(t, 'node-no-build-composer-without-prefix')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start a Node.js application with no build function in development mode when exposed in a composer by autodetecting the prefix', async t => {
  await verifyComposerAutodetectPrefix(t, 'node-no-build-composer-autodetect-prefix')
})

test('should detect and start a Node.js application with a build function in development mode when standalone', async t => {
  await verifyStandalone(t, 'node-with-build-standalone')
})

test('should detect and start a Node.js application with a build function in development mode when exposed in a composer with a prefix', async t => {
  await verifyComposerWithPrefix(t, 'node-with-build-composer-with-prefix')
})

test('should detect and start a Node.js application with a build function in development mode when exposed in a composer without a prefix', async t => {
  await verifyComposerWithoutPrefix(t, 'node-with-build-composer-without-prefix')
})

test('should detect and start a Node.js application with a build function in development mode when exposed in a composer by autodetecting the prefix', async t => {
  await verifyComposerAutodetectPrefix(t, 'node-with-build-composer-autodetect-prefix')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start an Express with no build function in development mode when standalone', async t => {
  await verifyStandalone(t, 'express-no-build-standalone')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start an Express with no build function in development mode when exposed in a composer with a prefix', async t => {
  await verifyComposerWithPrefix(t, 'express-no-build-composer-with-prefix')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start an Express with no build function in development mode when exposed in a composer without a prefix', async t => {
  await verifyComposerWithoutPrefix(t, 'express-no-build-composer-without-prefix')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start an Express with no build function in development mode when exposed in a composer by autodetecting the prefix', async t => {
  await verifyComposerAutodetectPrefix(t, 'express-no-build-composer-autodetect-prefix')
})

test('should detect and start an Express with a build function in development mode when standalone', async t => {
  await verifyStandalone(t, 'express-with-build-standalone')
})

test('should detect and start an Express with a build function in development mode when exposed in a composer with a prefix', async t => {
  await verifyComposerWithPrefix(t, 'express-with-build-composer-with-prefix')
})

test('should detect and start an Express with a build function in development mode when exposed in a composer without a prefix', async t => {
  await verifyComposerWithoutPrefix(t, 'express-with-build-composer-without-prefix')
})

test('should detect and start an Express with a build function in development mode when exposed in a composer by autodetecting the prefix', async t => {
  await verifyComposerAutodetectPrefix(t, 'express-with-build-composer-autodetect-prefix')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start an Fastify with no build function in development mode when standalone', async t => {
  await verifyStandalone(t, 'fastify-no-build-standalone')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start an Fastify with no build function in development mode when exposed in a composer with a prefix', async t => {
  await verifyComposerWithPrefix(t, 'fastify-no-build-composer-with-prefix')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start an Fastify with no build function in development mode when exposed in a composer without a prefix', async t => {
  await verifyComposerWithoutPrefix(t, 'fastify-no-build-composer-without-prefix')
})

// In this test the platformatic.runtime.json purposely does not specify a platformatic.application.json to see if we automatically detect one
test('should detect and start an Fastify with no build function in development mode when exposed in a composer by autodetecting the prefix', async t => {
  await verifyComposerAutodetectPrefix(t, 'fastify-no-build-composer-autodetect-prefix')
})

test('should detect and start an Fastify with a build function in development mode when standalone', async t => {
  await verifyStandalone(t, 'fastify-with-build-standalone')
})

test('should detect and start an Fastify with a build function in development mode when exposed in a composer with a prefix', async t => {
  await verifyComposerWithPrefix(t, 'fastify-with-build-composer-with-prefix')
})

test('should detect and start an Fastify with a build function in development mode when exposed in a composer without a prefix', async t => {
  await verifyComposerWithoutPrefix(t, 'fastify-with-build-composer-without-prefix')
})

test('should detect and start an Fastify with a build function in development mode when exposed in a composer by autodetecting the prefix', async t => {
  await verifyComposerAutodetectPrefix(t, 'fastify-with-build-composer-autodetect-prefix')
})
