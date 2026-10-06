import assert from 'assert'
import { test } from 'node:test'
import { resolve } from 'node:path'
import { request } from 'undici'
import { createApplication, createBasicApplication, createFromConfig, createOpenApiApplication } from '../helper.js'

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

test('the client span names the upstream getUpstream picked, not the configured origin', async t => {
  const upstream = await createApplication(t, [
    {
      method: 'GET',
      path: '/whoami',
      handler: async (_req, res) => res.send({ ok: true })
    }
  ])
  const upstreamOrigin = await upstream.listen({ host: '127.0.0.1', port: 0 })

  // Nothing listens on the configured origin: every request is served by the
  // upstream the custom hook selects, so a span naming the origin is reporting
  // a destination the request never reached.
  const configuredOrigin = 'http://origin-the-request-never-reaches.invalid'

  const gateway = await createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [
        {
          id: 'picked-elsewhere',
          origin: configuredOrigin,
          proxy: {
            prefix: '/',
            custom: {
              path: resolve(import.meta.dirname, '../proxy/fixtures/custom-header-cookie.js'),
              options: { upstreams: {}, fallback: upstreamOrigin }
            }
          }
        }
      ],
      refreshTimeout: 1000
    },
    telemetry: {
      applicationName: 'test-gateway',
      version: '1.0.0',
      exporter: { type: 'memory' }
    }
  })
  const gatewayUrl = await gateway.start({ listen: true })

  const { statusCode } = await request(gatewayUrl, { method: 'GET', path: '/whoami' })
  assert.equal(statusCode, 200, 'the upstream, not the configured origin, has to answer')

  const { exporters } = gateway.getApplication().openTelemetry
  const [proxyCallSpan] = exporters[0].getFinishedSpans()

  assert.equal(proxyCallSpan.attributes['url.full'], `${upstreamOrigin}/whoami`)
  assert.equal(proxyCallSpan.name, `GET ${upstreamOrigin}/whoami`)
})
