import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { createFromConfig, createOpenApiApplication } from '../helper.js'

// The API reference UI is pulled in through a dynamic import, so whether it is
// present in the module graph is the observable for "it was never loaded" -
// which is the point of the option, the 404 being only its side effect.
// These tests live in their own file because the check is process-wide: any
// gateway started with the default configuration loads the UI for good.
const require = createRequire(import.meta.url)

function apiReferenceIsLoaded () {
  // Normalise separators: on Windows the cache keys use backslashes.
  return Object.keys(require.cache).some(key => key.replace(/\\/g, '/').includes('@scalar/fastify-api-reference'))
}

async function createGateway (t, openapi) {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  return createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: {
            url: '/documentation/json'
          }
        }
      ],
      openapi
    }
  })
}

test('ui: false keeps the spec routes and never loads the API reference UI', async t => {
  const gateway = await createGateway(t, { ui: false })

  {
    const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/documentation/json' })
    assert.equal(statusCode, 200)
    assert.ok(JSON.parse(body).openapi, 'json spec is served')
  }

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/documentation/yaml' })
    assert.equal(statusCode, 200, 'yaml spec is served')
  }

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/documentation/' })
    assert.equal(statusCode, 404, 'no API reference UI')
  }

  assert.equal(apiReferenceIsLoaded(), false, 'the API reference UI is not loaded')
})

// Positive control for the assertion above: it also proves the module graph
// check can observe the UI at all, so it cannot quietly stop measuring.
test('ui defaults to true: the API reference UI is served and loaded', async t => {
  const gateway = await createGateway(t, {})

  const { statusCode } = await gateway.inject({ method: 'GET', url: '/documentation/' })
  assert.equal(statusCode, 200, 'API reference UI is served')

  assert.equal(apiReferenceIsLoaded(), true, 'the API reference UI is loaded')
})
