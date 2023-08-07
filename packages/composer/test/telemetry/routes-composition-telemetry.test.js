'use strict'

const { test } = require('tap')
const { request } = require('undici')
const {
  createComposer,
  createOpenApiService
} = require('../helper')

test('should compose openapi with prefixes', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api1Origin = await api1.listen({ port: 0 })

  const composer = await createComposer(t, {
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

  const composerOrigin = await composer.start()

  const res = await request(composerOrigin, {
    method: 'GET',
    path: '/api1/users',
    headers: {
      'content-type': 'application/json'
    }
  })
  const statusCode = res.statusCode
  t.equal(statusCode, 200)

  // Check that the client span is correctly set
  const { exporter } = composer.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  t.equal(finishedSpans.length, 2)
  const proxyCallSpan = finishedSpans[0]
  const composerCallSpan = finishedSpans[1]
  t.equal(proxyCallSpan.name, `GET ${api1Origin}/api1/users`)
  t.equal(proxyCallSpan.attributes['url.full'], `${api1Origin}/api1/users`)
  t.equal(proxyCallSpan.attributes['http.response.status_code'], 200)
  t.equal(proxyCallSpan.parentSpanId, composerCallSpan.spanContext().spanId)
  t.equal(proxyCallSpan.traceId, composerCallSpan.traceId)
})
