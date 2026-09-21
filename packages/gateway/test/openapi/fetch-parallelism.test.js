import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import fastify from 'fastify'

import { createFromConfig } from '../helper.js'

function buildOpenApiSchema (pathName) {
  return {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {
      [`/${pathName}`]: {
        get: {
          operationId: `get_${pathName}`,
          responses: {
            200: { description: 'OK' }
          }
        }
      }
    }
  }
}

test('should fetch application schemas in parallel at startup', async t => {
  const applicationsCount = 3

  let inFlight = 0
  let maxInFlight = 0

  const applications = []
  for (let i = 0; i < applicationsCount; i++) {
    const pathName = `entities${i}`
    const app = fastify({
      logger: false,
      keepAliveTimeout: 10,
      forceCloseConnections: true
    })

    app.get('/documentation/json', async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await sleep(200)
      inFlight--
      return buildOpenApiSchema(pathName)
    })

    app.get(`/${pathName}`, async () => ({ ok: true }))

    t.after(async () => {
      await app.close()
    })

    await app.listen({ port: 0 })

    applications.push({
      id: `api${i}`,
      origin: 'http://127.0.0.1:' + app.server.address().port,
      openapi: {
        url: '/documentation/json',
        prefix: `/api${i}`
      }
    })
  }

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: { applications }
  })

  await gateway.start({ listen: true })

  assert.equal(maxInFlight, applicationsCount, 'schema fetches should overlap')

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const composedSchema = JSON.parse(body)
  const composedPaths = Object.keys(composedSchema.paths)

  // Composition must stay deterministic and follow the applications order
  assert.deepEqual(composedPaths, ['/api0/entities0', '/api1/entities1', '/api2/entities2'])
})
