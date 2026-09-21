import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, getConnectionInfo } from './helper.js'

// The option reaches @platformatic/sql-openapi through db.openapi; this file
// pins that wiring. The API reference UI is pulled in through a dynamic
// import, so its presence in the module graph is the observable for "it was
// never loaded" - the point of the option, the 404 being its side effect.
// These tests live in their own file because the check is process-wide: any
// application started with the default configuration loads the UI for good.
const require = createRequire(import.meta.url)

function apiReferenceIsLoaded () {
  // Normalise separators: on Windows the cache keys use backslashes.
  return Object.keys(require.cache).some(key => key.replace(/\\/g, '/').includes('@scalar/fastify-api-reference'))
}

async function createApp (t, openapi) {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo,
      openapi
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  return app
}

test('db.openapi.ui: false keeps the spec routes and never loads the API reference UI', async t => {
  const app = await createApp(t, { ui: false })

  const json = await request(`${app.url}/documentation/json`)
  assert.equal(json.statusCode, 200, 'json spec is served')
  assert.ok((await json.body.json()).openapi)

  const yaml = await request(`${app.url}/documentation/yaml`)
  assert.equal(yaml.statusCode, 200, 'yaml spec is served')

  const ui = await request(`${app.url}/documentation/`)
  assert.equal(ui.statusCode, 404, 'no API reference UI')

  assert.equal(apiReferenceIsLoaded(), false, 'the API reference UI is not loaded')
})

// Positive control for the assertion above: it also proves the module graph
// check can observe the UI at all, so it cannot quietly stop measuring.
test('db.openapi.ui defaults to true: the API reference UI is served and loaded', async t => {
  const app = await createApp(t, {})

  const ui = await request(`${app.url}/documentation/`)
  assert.equal(ui.statusCode, 200, 'API reference UI is served')

  assert.equal(apiReferenceIsLoaded(), true, 'the API reference UI is loaded')
})
