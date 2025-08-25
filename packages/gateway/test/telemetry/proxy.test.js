import assert from 'assert'
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
    assert.equal(finishedSpans.length, 2)

    const proxyCallSpan = finishedSpans[0]
    const gatewayCallSpan = finishedSpans[1]
    assert.equal(proxyCallSpan.name, `GET ${origin1}/internal/service1/users`)
    assert.equal(proxyCallSpan.attributes['url.full'], `${origin1}/internal/service1/users`)
    assert.equal(proxyCallSpan.attributes['http.response.status_code'], 200)
    assert.equal(proxyCallSpan.parentSpanContext.spanId, gatewayCallSpan.spanContext().spanId)
    assert.equal(proxyCallSpan.traceId, gatewayCallSpan.traceId)
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
    const span = finishedSpans[0]
    assert.equal(span.name, `GET ${origin1}/internal/service1/error`)
    assert.equal(span.attributes['url.full'], `${origin1}/internal/service1/error`)
    assert.equal(span.attributes['http.response.status_code'], 500)
  }
})
