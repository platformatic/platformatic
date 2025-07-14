import assert from 'assert/strict'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, createOpenApiService } from '../helper.js'

test('should expose x-forwarded-* headers', async t => {
  const service1 = await createOpenApiService(t, ['users'], { addHeadersSchema: true })

  const origin1 = await service1.listen({ port: 0 })

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    composer: {
      services: [
        {
          id: 'service1',
          origin: origin1,
          openapi: {
            url: '/documentation/json',
            prefix: '/internal/service1'
          }
        }
      ],
      refreshTimeout: 1000
    }
  }

  const composer = await createFromConfig(t, config)
  const composerOrigin = await composer.start({ listen: true })
  // internal service gets the x-forwarded-for and x-forwarded-host headers
  const { statusCode, body } = await request(composerOrigin, {
    method: 'GET',
    path: '/internal/service1/headers'
  })
  assert.equal(statusCode, 200)

  const returnedHeaders = await body.json()

  const expectedForwardedHost = composerOrigin.replace('http://', '')
  const [expectedForwardedFor] = expectedForwardedHost.split(':')
  assert.equal(returnedHeaders['x-forwarded-host'], expectedForwardedHost)
  assert.equal(returnedHeaders['x-forwarded-for'], expectedForwardedFor)
})
