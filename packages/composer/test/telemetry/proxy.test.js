'use strict'

const { test } = require('tap')
const { request } = require('undici')
const {
  createComposer,
  createOpenApiService,
  createBasicService
} = require('../helper')

test('should proxy openapi requests with telemetry span', async (t) => {
  const service1 = await createOpenApiService(t, ['users'])
  const origin1 = await service1.listen({ host: '127.0.0.1', port: 0 })

  const config = {
    composer: {
      services: [
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
      serviceName: 'test-composer',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    }
  }

  const composer = await createComposer(t, config)
  const composerUrl = await composer.start()

  {
    const res = await request(composerUrl, {
      method: 'GET',
      path: '/internal/service1/users',
      headers: {
        'content-type': 'application/json'
      }
    })
    const statusCode = res.statusCode
    t.equal(statusCode, 200)

    // Check that the client span is correctly set
    const { exporters } = composer.openTelemetry
    const finishedSpans = exporters[0].getFinishedSpans()
    t.equal(finishedSpans.length, 2)

    const proxyCallSpan = finishedSpans[0]
    const composerCallSpan = finishedSpans[1]
    t.equal(proxyCallSpan.name, `GET ${origin1}/internal/service1/users`)
    t.equal(proxyCallSpan.attributes['url.full'], `${origin1}/internal/service1/users`)
    t.equal(proxyCallSpan.attributes['http.response.status_code'], 200)
    t.equal(proxyCallSpan.parentSpanId, composerCallSpan.spanContext().spanId)
    t.equal(proxyCallSpan.traceId, composerCallSpan.traceId)
  }
})

test('should proxy openapi requests with telemetry, managing errors', async (t) => {
  const service1 = await createBasicService(t)
  const origin1 = await service1.listen({ host: '127.0.0.1', port: 0 })

  const config = {
    composer: {
      services: [
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
      serviceName: 'test-composer',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    }
  }

  const composer = await createComposer(t, config)
  const composerUrl = await composer.start()

  {
    const res = await request(composerUrl, {
      method: 'GET',
      path: '/internal/service1/error',
      headers: {
        'content-type': 'application/json'
      }
    })
    const statusCode = res.statusCode
    t.equal(statusCode, 500)

    // Check that the client span is correctly set
    const { exporters } = composer.openTelemetry
    const finishedSpans = exporters[0].getFinishedSpans()
    const span = finishedSpans[0]
    t.equal(span.name, `GET ${origin1}/internal/service1/error`)
    t.equal(span.attributes['url.full'], `${origin1}/internal/service1/error`)
    t.equal(span.attributes['http.response.status_code'], 500)
  }
})
