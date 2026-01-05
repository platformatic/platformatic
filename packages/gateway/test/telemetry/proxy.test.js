import assert from 'assert'
import { SpanKind } from '@opentelemetry/api'
import { test } from 'node:test'
import { request } from 'undici'
import { createBasicApplication, createFromConfig, createOpenApiApplication } from '../helper.js'

test('should proxy openapi requests with telemetry span', async t => {
  const service1 = await createOpenApiApplication(t, ['users'])

  const origin1 = await service1.listen({ host: '127.0.0.1', port: 0 })

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'service1',
          origin: origin1,
          proxy: {
            prefix: '/internal/service1'
          }
        }
      ],
      refreshTimeout: 1000
    },
    telemetry: {
      applicationName: 'test-gateway',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    }
  }

  const gateway = await createFromConfig(t, config)
  const gatewayUrl = await gateway.start({ listen: true })

  {
    const res = await request(gatewayUrl, {
      method: 'GET',
      path: '/internal/service1/users',
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
    // In proxy mode, the gateway strips the prefix and forwards to the backend
    // So we look for the span with the backend path (/users) that has a parent
    const proxyCallSpan = finishedSpans.find(s =>
      s.kind === SpanKind.CLIENT &&
      s.attributes['url.path'] === '/users' &&
      s.parentSpanContext  // Only spans with a parent (not initial requests)
    )
    assert.ok(proxyCallSpan, 'Should have HTTP CLIENT span for proxy call')

    // The span name will be just "GET" from the HTTP instrumentation
    assert.equal(proxyCallSpan.name, 'GET')
    assert.ok(proxyCallSpan.attributes['url.full'].includes('/users'))
    assert.equal(proxyCallSpan.attributes['http.response.status_code'], 200)

    // Verify the proxy call span has a parent span (the gateway request handler)
    assert.ok(proxyCallSpan.parentSpanContext, 'Proxy call should have a parent span')
    assert.ok(proxyCallSpan.parentSpanContext.spanId, 'Proxy call should have a parent span ID')
  }
})

test('should proxy openapi requests with telemetry, managing errors', async t => {
  const service1 = await createBasicApplication(t)
  const origin1 = await service1.listen({ host: '127.0.0.1', port: 0 })

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'service1',
          origin: origin1,
          proxy: {
            prefix: '/internal/service1'
          }
        }
      ],
      refreshTimeout: 1000
    },
    telemetry: {
      applicationName: 'test-gateway',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    }
  }

  const gateway = await createFromConfig(t, config)
  const gatewayUrl = await gateway.start({ listen: true })

  {
    const res = await request(gatewayUrl, {
      method: 'GET',
      path: '/internal/service1/error',
      headers: {
        'content-type': 'application/json'
      }
    })
    const statusCode = res.statusCode
    assert.equal(statusCode, 500)

    // Check that the client span is correctly set
    const { exporters } = gateway.getApplication().openTelemetry
    const finishedSpans = exporters[0].getFinishedSpans()

    // Find the HTTP CLIENT span for the proxied request that errored
    // In proxy mode, the gateway strips the prefix and forwards to the backend
    // So we look for the span with the backend path (/error) that has a parent
    const proxyCallSpan = finishedSpans.find(s =>
      s.kind === SpanKind.CLIENT &&
      s.attributes['url.path'] === '/error' &&
      s.parentSpanContext  // Only spans with a parent
    )
    assert.ok(proxyCallSpan, 'Should have HTTP CLIENT span for proxy call')

    // The span name will be just "GET" from the HTTP instrumentation
    assert.equal(proxyCallSpan.name, 'GET')
    assert.ok(proxyCallSpan.attributes['url.full'].includes('/error'))
    assert.equal(proxyCallSpan.attributes['http.response.status_code'], 500)
  }
})
