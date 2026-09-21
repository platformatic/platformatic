import assert from 'node:assert'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig } from './helper.js'

// The API reference UI is pulled in through a dynamic import, so whether it is
// present in the module graph is the observable for "it was never loaded" -
// which is the point of the option, the 404 being only its side effect.
// These tests live in their own file because the check is process-wide: any
// application started with the default configuration loads the UI for good.
const require = createRequire(import.meta.url)

function apiReferenceIsLoaded () {
  // Normalise separators: on Windows the cache keys use backslashes.
  return Object.keys(require.cache).some(key => key.replace(/\\/g, '/').includes('@scalar/fastify-api-reference'))
}

function createConfig (openapi) {
  return {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      forceCloseConnections: true
    },
    service: {
      openapi: {
        path: join(import.meta.dirname, 'fixtures', 'openapi-spec-test.json'),
        ...openapi
      }
    },
    watch: false
  }
}

test('ui: false keeps the spec routes and never loads the API reference UI', async t => {
  const app = await createFromConfig(t, createConfig({ ui: false }))
  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const json = await request(`${app.url}/documentation/json`)
  assert.strictEqual(json.statusCode, 200, 'json spec is served')
  const body = await json.body.json()
  assert.ok(body.paths['/hello'], 'spec content')

  const yaml = await request(`${app.url}/documentation/yaml`)
  assert.strictEqual(yaml.statusCode, 200, 'yaml spec is served')

  const ui = await request(`${app.url}/documentation/`)
  assert.strictEqual(ui.statusCode, 404, 'no API reference UI')

  assert.strictEqual(apiReferenceIsLoaded(), false, 'the API reference UI is not loaded')
})

// Positive control for the assertion above: it also proves the module graph
// check can observe the UI at all, so it cannot quietly stop measuring.
test('ui defaults to true: the API reference UI is served and loaded', async t => {
  const app = await createFromConfig(t, createConfig())
  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const ui = await request(`${app.url}/documentation/`)
  assert.strictEqual(ui.statusCode, 200, 'API reference UI is served')

  assert.strictEqual(apiReferenceIsLoaded(), true, 'the API reference UI is loaded')
})
