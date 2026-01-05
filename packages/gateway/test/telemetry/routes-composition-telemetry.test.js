import assert from 'assert/strict'
import { SpanKind } from '@opentelemetry/api'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, createOpenApiApplication } from '../helper.js'

test('should compose openapi with prefixes', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])

  const api1Origin = await api1.listen({ host: '127.0.0.1', port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
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
      applicationName: 'test-gateway',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  const res = await request(gatewayOrigin, {
    method: 'GET',
    path: '/api1/users',
    headers: {
      'content-type': 'application/json'
    }
  })
  const statusCode = res.statusCode
  assert.equal(statusCode, 200)

  // Check that the client span is correctly set
  const { exporters } = gateway.getApplication().openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()

  // With @fastify/otel, we get multiple INTERNAL spans for Fastify lifecycle
  // plus CLIENT spans for HTTP requests
  assert.ok(finishedSpans.length >= 2, `Expected at least 2 spans, got ${finishedSpans.length}`)

  // Find the HTTP CLIENT span for the proxied request to the backend service
  // The gateway makes a request to the backend with the original path (/users)
  // not the prefixed path (/api1/users)
  const proxyCallSpan = finishedSpans.find(s =>
    s.kind === SpanKind.CLIENT &&
    s.attributes['url.path'] === '/users' &&
    s.parentSpanContext  // Only spans with a parent (not the initial schema fetch)
  )
  assert.ok(proxyCallSpan, 'Should have HTTP CLIENT span for proxy call')

  // The span name will be just "GET" from the HTTP instrumentation
  assert.equal(proxyCallSpan.name, 'GET')
  assert.ok(proxyCallSpan.attributes['url.full'].includes('/users'))
  assert.equal(proxyCallSpan.attributes['http.response.status_code'], 200)

  // Verify the proxy call span has a parent span (the gateway request handler)
  assert.ok(proxyCallSpan.parentSpanContext, 'Proxy call should have a parent span')
  assert.ok(proxyCallSpan.parentSpanContext.spanId, 'Proxy call should have a parent span ID')
})
