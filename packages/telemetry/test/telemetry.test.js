'use strict'

const { test } = require('tap')
const fastify = require('fastify')
const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const telemetryPlugin = require('../lib/telemetry')

async function setupApp (pluginOpts, routeHandler, teardown) {
  const app = fastify()
  await app.register(telemetryPlugin, pluginOpts)
  app.get('/test', routeHandler)
  app.ready()
  teardown(async () => {
    await app.close()
    const { exporter } = app.openTelemetry
    if (exporter.constructor.name === 'InMemorySpanExporter') {
      exporter.reset()
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

test('should trace a request not failing', async ({ equal, same, teardown }) => {
  const handler = async (request, reply) => {
    return { foo: 'bar' }
  }

  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }, handler, teardown)

  await app.inject(injectArgs)
  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const span = finishedSpans[0]
  equal(span.kind, SpanKind.SERVER)
  equal(span.name, 'GET /test')
  equal(span.status.code, SpanStatusCode.OK)
  equal(span.attributes['http.request.method'], 'GET')
  equal(span.attributes['url.path'], '/test')
  equal(span.attributes['http.response.status_code'], 200)
  equal(span.attributes['url.scheme'], 'http')
  equal(span.attributes['server.address'], 'test')
  const resource = span.resource
  same(resource.attributes['service.name'], 'test-service')
  same(resource.attributes['service.version'], '1.0.0')
})

test('request should add attribute to a span', async ({ equal, same, teardown }) => {
  const handler = async (request, reply) => {
    request.span.setAttribute('foo', 'bar')
    return { foo: 'bar' }
  }

  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }, handler, teardown)

  await app.inject(injectArgs)
  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const span = finishedSpans[0]
  equal(span.name, 'GET /test')
  equal(span.status.code, SpanStatusCode.OK)
  equal(span.attributes['http.request.method'], 'GET')
  equal(span.attributes['url.path'], '/test')
  equal(span.attributes['http.response.status_code'], 200)
  // This is the attribute we added
  equal(span.attributes.foo, 'bar')
  const resource = span.resource
  same(resource.attributes['service.name'], 'test-service')
  same(resource.attributes['service.version'], '1.0.0')
})

test('should be able to set the W3C trace context', async ({ equal, same, teardown, ok }) => {
  const handler = async (request, reply) => {
    const context = request.openTelemetry().span.context
    const newContext = context.setValue('foo', 'bar')
    request.openTelemetry().span.context = newContext
    return { foo: 'bar' }
  }

  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }, handler, teardown)

  const response = await app.inject(injectArgs)
  // see: https://www.w3.org/TR/trace-context/#design-overview
  ok(response.headers.traceparent)
})

test('should trace a request that fails', async ({ equal, same, teardown }) => {
  const handler = async (request, reply) => {
    throw new Error('booooom!!!')
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }, handler, teardown)

  await app.inject(injectArgs)
  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const span = finishedSpans[0]
  equal(span.name, 'GET /test')
  equal(span.status.code, SpanStatusCode.ERROR)
  equal(span.attributes['http.request.method'], 'GET')
  equal(span.attributes['url.path'], '/test')
  equal(span.attributes['http.response.status_code'], 500)
  equal(span.attributes['error.message'], 'booooom!!!')
  const resource = span.resource
  same(resource.attributes['service.name'], 'test-service')
  same(resource.attributes['service.version'], '1.0.0')
})

test('if no exporter is configured, should default to console', async ({ equal, same, teardown }) => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0'
  }, handler, teardown)

  await app.inject(injectArgs)
  const { exporter } = app.openTelemetry
  same(exporter.constructor.name, 'ConsoleSpanExporter')
})

test('should configure OTLP correctly', async ({ equal, same, teardown }) => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'otlp',
      options: {
        url: 'http://localhost:4317'
      }
    }
  }, handler, teardown)

  const { exporter } = app.openTelemetry
  same(exporter.constructor.name, 'OTLPTraceExporter')
  same(exporter.url, 'http://localhost:4317')
})

test('should configure Zipkin correctly', async ({ equal, same, teardown }) => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'zipkin',
      options: {
        url: 'http://localhost:9876'
      }
    }
  }, handler, teardown)

  const { exporter } = app.openTelemetry
  same(exporter.constructor.name, 'ZipkinExporter')
  same(exporter._urlStr, 'http://localhost:9876')
})

test('wrong exporter is configured, should default to console', async ({ equal, same, teardown }) => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'wrong-exporter'
    }
  }, handler, teardown)

  await app.inject(injectArgs)
  const { exporter } = app.openTelemetry
  same(exporter.constructor.name, 'ConsoleSpanExporter')
})
