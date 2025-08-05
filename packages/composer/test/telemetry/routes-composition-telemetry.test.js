import assert from 'assert/strict'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, createOpenApiService } from '../helper.js'

test('should compose openapi with prefixes', async t => {
  const api1 = await createOpenApiService(t, ['users'])

  const api1Origin = await api1.listen({ host: '127.0.0.1', port: 0 })

  const composer = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    composer: {
      services: [
        {
          id: 'api1',
          origin: `${api1Origin}`,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        }
      ]
    },
    telemetry: {
      serviceName: 'test-composer',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    }
  })

  const composerOrigin = await composer.start({ listen: true })

  const res = await request(composerOrigin, {
    method: 'GET',
    path: '/api1/users',
    headers: {
      'content-type': 'application/json'
    }
  })
  const statusCode = res.statusCode
  assert.equal(statusCode, 200)

  // Check that the client span is correctly set
  const { exporters } = composer.getApplication().openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()
  assert.equal(finishedSpans.length, 2)
  const proxyCallSpan = finishedSpans[0]
  const composerCallSpan = finishedSpans[1]
  assert.equal(proxyCallSpan.name, `GET ${api1Origin}/api1/users`)
  assert.equal(proxyCallSpan.attributes['url.full'], `${api1Origin}/api1/users`)
  assert.equal(proxyCallSpan.attributes['http.response.status_code'], 200)
  assert.equal(proxyCallSpan.parentSpanContext.spanId, composerCallSpan.spanContext().spanId)
  assert.equal(proxyCallSpan.traceId, composerCallSpan.traceId)
})
