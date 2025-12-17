import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import fastify from 'fastify'
import { deepEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'
import telemetryPlugin from '../lib/telemetry.js'

async function setupApp (pluginOpts, routeHandler, teardown) {
  const app = fastify()
  await app.register(telemetryPlugin, pluginOpts)
  app.get('/test', routeHandler)
  app.get('/test/:id', routeHandler)
  await app.ready()
  teardown(async () => {
    await app.close()
    if (app.openTelemetry) {
      const { exporters } = app.openTelemetry
      exporters.forEach(exporter => {
        if (exporter.constructor.name === 'InMemorySpanExporter') {
          exporter.reset()
        }
      })
    }
  })
  return app
}

const injectArgs = {
  method: 'GET',
  url: '/test',
  headers: {
    host: 'test'
  }
}

test('should trace a request not failing', async () => {
  const handler = async (request, reply) => {
    return { foo: 'bar' }
  }

  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    handler,
    test.after
  )

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()

  // Now expect multiple spans: SERVER (HTTP layer) + INTERNAL (Fastify layer)
  ok(finishedSpans.length >= 2, `Expected at least 2 spans, got ${finishedSpans.length}`)

  // Find the SERVER span (HTTP layer)
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)
  ok(serverSpan, 'Should have SERVER span')
  equal(serverSpan.name, 'GET /test')
  equal(serverSpan.status.code, SpanStatusCode.OK)
  equal(serverSpan.attributes['http.request.method'], 'GET')
  equal(serverSpan.attributes['url.path'], '/test')
  equal(serverSpan.attributes['http.response.status_code'], 200)
  equal(serverSpan.attributes['url.scheme'], 'http')
  equal(serverSpan.attributes['server.address'], 'test')
  // SERVER spans should NOT have url.full per OTel spec

  // Find the INTERNAL span with http.route (Fastify layer)
  const routeSpan = finishedSpans.find(span =>
    span.kind === SpanKind.INTERNAL && span.attributes['http.route']
  )
  ok(routeSpan, 'Should have INTERNAL span with http.route')
  equal(routeSpan.attributes['http.route'], '/test')

  // Check resource attributes (should be same on all spans)
  const resource = serverSpan.resource
  deepEqual(resource.attributes['service.name'], 'test-application')
  deepEqual(resource.attributes['service.version'], '1.0.0')
})

test('should not put query in `url.path', async () => {
  const handler = async (request, reply) => {
    return { foo: 'bar' }
  }

  const injectArgs = {
    method: 'GET',
    url: '/test?foo=bar',
    headers: {
      host: 'test'
    }
  }

  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    handler,
    test.after
  )

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()

  // Expect multiple spans: SERVER (HTTP) + INTERNAL (Fastify)
  ok(finishedSpans.length >= 1, `Expected at least 1 span, got ${finishedSpans.length}`)

  // Find the SERVER span (HTTP layer)
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)
  ok(serverSpan, 'Should have SERVER span')
  equal(serverSpan.name, 'GET /test')
  equal(serverSpan.status.code, SpanStatusCode.OK)
  equal(serverSpan.attributes['http.request.method'], 'GET')
  equal(serverSpan.attributes['url.path'], '/test')
  equal(serverSpan.attributes['url.query'], 'foo=bar')
  equal(serverSpan.attributes['http.response.status_code'], 200)
  equal(serverSpan.attributes['url.scheme'], 'http')
  equal(serverSpan.attributes['server.address'], 'test')
  // SERVER spans should NOT have url.full per OTel spec
  const resource = serverSpan.resource
  deepEqual(resource.attributes['service.name'], 'test-application')
  deepEqual(resource.attributes['service.version'], '1.0.0')
})

test('request should add attribute to a span', async () => {
  const { trace } = await import('@opentelemetry/api')

  const handler = async (request, reply) => {
    // Use OpenTelemetry API to get active span instead of request.span
    const activeSpan = trace.getActiveSpan()
    if (activeSpan) {
      activeSpan.setAttribute('foo', 'bar')
    }
    return { foo: 'bar' }
  }

  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    handler,
    test.after
  )

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()

  // Find a span with our custom attribute
  const spanWithCustomAttr = finishedSpans.find(span => span.attributes.foo === 'bar')
  ok(spanWithCustomAttr, 'Should have span with custom attribute')
  equal(spanWithCustomAttr.attributes.foo, 'bar')
})

test('should trace a request that fails', async () => {
  const handler = async (request, reply) => {
    throw new Error('booooom!!!')
  }
  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    handler,
    test.after
  )

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()

  // Find the SERVER span (HTTP layer)
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)
  ok(serverSpan, 'Should have SERVER span')
  equal(serverSpan.name, 'GET /test')
  equal(serverSpan.status.code, SpanStatusCode.ERROR)
  equal(serverSpan.attributes['http.request.method'], 'GET')
  equal(serverSpan.attributes['url.path'], '/test')
  equal(serverSpan.attributes['http.response.status_code'], 500)
  const resource = serverSpan.resource
  equal(resource.attributes['service.name'], 'test-application')
  equal(resource.attributes['service.version'], '1.0.0')
})

test('if no exporter is configured, should default to console', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0'
    },
    handler,
    test.after
  )

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  equal(exporter.constructor.name, 'ConsoleSpanExporter')
})

test('should configure OTLP correctly', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: {
        type: 'otlp',
        options: {
          url: 'http://localhost:4317'
        }
      }
    },
    handler,
    test.after
  )

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const exporterUrl = (exporter._delegate ?? exporter)._transport._transport._parameters.url
  equal(exporter.constructor.name, 'OTLPTraceExporter')
  equal(exporterUrl, 'http://localhost:4317')
})

test('should configure Zipkin correctly', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: {
        type: 'zipkin',
        options: {
          url: 'http://localhost:9876'
        }
      }
    },
    handler,
    test.after
  )

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  equal(exporter.constructor.name, 'ZipkinExporter')
  equal(exporter._urlStr, 'http://localhost:9876')
})

test('wrong exporter is configured, should default to console', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: {
        type: 'wrong-exporter'
      }
    },
    handler,
    test.after
  )

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  equal(exporter.constructor.name, 'ConsoleSpanExporter')
})

test('should not trace if the operation is skipped', async () => {
  const handler = async (request, reply) => {
    return { foo: 'bar' }
  }

  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      skip: [
        {
          path: '/documentation/json',
          method: 'GET'
        }
      ],
      exporter: {
        type: 'memory'
      }
    },
    handler,
    test.after
  )

  const injectArgs = {
    method: 'GET',
    url: '/documentation/json',
    headers: {
      host: 'test'
    }
  }

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 0)
})

test('should send a span for a route with a parametric path', async () => {
  const handler = async (request, reply) => {
    return { foo: 'bar' }
  }

  const injectArgs = {
    method: 'GET',
    url: '/test/123',
    headers: {
      host: 'test'
    }
  }

  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    handler,
    test.after
  )

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()

  // Expect multiple spans: SERVER (HTTP) + INTERNAL (Fastify with route pattern)
  ok(finishedSpans.length >= 1, `Expected at least 1 span, got ${finishedSpans.length}`)

  // Find the SERVER span (HTTP layer) - has actual path
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)
  ok(serverSpan, 'Should have SERVER span')
  equal(serverSpan.name, 'GET /test/123')
  equal(serverSpan.status.code, SpanStatusCode.OK)
  equal(serverSpan.attributes['http.request.method'], 'GET')
  equal(serverSpan.attributes['url.path'], '/test/123')
  equal(serverSpan.attributes['http.response.status_code'], 200)
  equal(serverSpan.attributes['url.scheme'], 'http')
  equal(serverSpan.attributes['server.address'], 'test')
  // SERVER spans should NOT have url.full per OTel spec
  const resource = serverSpan.resource
  equal(resource.attributes['service.name'], 'test-application')
  equal(resource.attributes['service.version'], '1.0.0')

  // Find the INTERNAL span (Fastify layer) - has route pattern
  const internalSpan = finishedSpans.find(span =>
    span.kind === SpanKind.INTERNAL && span.attributes['http.route']
  )
  ok(internalSpan, 'Should have INTERNAL span with http.route')
  equal(internalSpan.attributes['http.route'], '/test/:id')
})

test('should configure an exporter as an array', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: [
        {
          type: 'otlp',
          options: {
            url: 'http://localhost:4317'
          }
        }
      ]
    },
    handler,
    test.after
  )

  const injectArgs = {
    method: 'GET',
    url: '/test/123',
    headers: {
      host: 'test'
    }
  }
  await app.inject(injectArgs)

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const exporterUrl = (exporter._delegate ?? exporter)._transport._transport._parameters.url
  equal(exporter.constructor.name, 'OTLPTraceExporter')
  equal(exporterUrl, 'http://localhost:4317')
})

test('do not stop closing the server if the exporter fails', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: [
        {
          type: 'otlp',
          options: {
            url: 'http://risk-engine.local'
          }
        }
      ]
    },
    handler,
    test.after
  )

  // We need to send some data to the server to make sure there is data
  // to flush via the exporter
  const injectArgs = {
    method: 'GET',
    url: '/test/123',
    headers: {
      host: 'test'
    }
  }
  await app.inject(injectArgs)
})

test('should use multiple exporters and sent traces to all the exporters', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp(
    {
      applicationName: 'test-application',
      version: '1.0.0',
      exporter: [
        {
          type: 'memory'
        },
        {
          type: 'memory'
        }
      ]
    },
    handler,
    test.after
  )
  const { exporters } = app.openTelemetry

  await app.inject(injectArgs)

  // Both exporters should receive the same spans
  const finishedSpans0 = exporters[0].getFinishedSpans()
  ok(finishedSpans0.length >= 1, `Exporter 0: Expected at least 1 span, got ${finishedSpans0.length}`)
  const serverSpan0 = finishedSpans0.find(span => span.kind === SpanKind.SERVER)
  ok(serverSpan0, 'Exporter 0: Should have SERVER span')
  equal(serverSpan0.name, 'GET /test')
  equal(serverSpan0.status.code, SpanStatusCode.OK)

  const finishedSpans1 = exporters[1].getFinishedSpans()
  ok(finishedSpans1.length >= 1, `Exporter 1: Expected at least 1 span, got ${finishedSpans1.length}`)
  const serverSpan1 = finishedSpans1.find(span => span.kind === SpanKind.SERVER)
  ok(serverSpan1, 'Exporter 1: Should have SERVER span')
  equal(serverSpan1.name, 'GET /test')
  equal(serverSpan1.status.code, SpanStatusCode.OK)
})

test('telemetry can be disabled', async () => {
  const app = fastify()
  await app.register(telemetryPlugin, { enabled: false })
  await app.ready()

  equal(app.openTelemetry, undefined)
})
