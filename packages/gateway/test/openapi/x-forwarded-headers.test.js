import assert from 'assert/strict'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, createOpenApiApplication } from '../helper.js'

test('should expose x-forwarded-* headers', async t => {
  const application1 = await createOpenApiApplication(t, ['users'], { addHeadersSchema: true })

  const origin1 = await application1.listen({ port: 0 })

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'application1',
          origin: origin1,
          openapi: {
            url: '/documentation/json',
            prefix: '/internal/application1'
          }
        }
      ],
      refreshTimeout: 1000
    }
  }

  const gateway = await createFromConfig(t, config)
  const gatewayOrigin = await gateway.start({ listen: true })
  // internal application gets the x-forwarded-for and x-forwarded-host headers
  const { statusCode, body } = await request(gatewayOrigin, {
    method: 'GET',
    path: '/internal/application1/headers'
  })
  assert.equal(statusCode, 200)

  const returnedHeaders = await body.json()

  const expectedForwardedHost = gatewayOrigin.replace('http://', '')
  const [expectedForwardedFor] = expectedForwardedHost.split(':')
  assert.equal(returnedHeaders['x-forwarded-host'], expectedForwardedHost)
  assert.equal(returnedHeaders['x-forwarded-for'], expectedForwardedFor)
})
