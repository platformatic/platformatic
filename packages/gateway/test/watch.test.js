import assert from 'node:assert/strict'
import { test } from 'node:test'
import { request } from 'undici'
import {
  createGatewayInRuntime,
  createOpenApiApplication,
  REFRESH_TIMEOUT,
  testEntityRoutes,
  waitForRestart
} from './helper.js'

test('gateway should restart when openapi changes', async t => {
  const openapi1 = await createOpenApiApplication(t, ['users'])
  const openapi1Origin = await openapi1.listen()
  const port = openapi1.server.address().port
  const openapi1a = await createOpenApiApplication(t, ['posts'])

  const runtime = await createGatewayInRuntime(t, 'gateway-external-watch', {
    gateway: {
      applications: [
        {
          id: 'openapi1',
          origin: openapi1Origin,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        }
      ],
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  let { 'composer:0': gatewayOrigin } = await runtime.start()

  {
    const res = await request(gatewayOrigin, { path: '/documentation/json' })
    assert.equal(res.statusCode, 200, 'openapi are reachable on gateway')
    await res.body.text()
  }
  await testEntityRoutes(gatewayOrigin, ['/api1/users'])

  const restart = waitForRestart(runtime)
  await openapi1.close()
  await openapi1a.listen({ port })

  gatewayOrigin = await restart

  {
    const res = await request(gatewayOrigin, { path: '/documentation/json' })
    assert.equal(res.statusCode, 200)
    await res.body.text()
  }
  await testEntityRoutes(gatewayOrigin, ['/api1/posts'], 'openapi updated')
})
