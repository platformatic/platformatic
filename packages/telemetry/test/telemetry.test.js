'use strict'

const { test } = require('node:test')
const { deepEqual, equal, ok } = require('node:assert')
const fastify = require('fastify')
const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const telemetryPlugin = require('../lib/telemetry')

async function setupApp (pluginOpts, routeHandler, teardown) {
  const app = fastify()
  await app.register(telemetryPlugin, pluginOpts)
  app.get('/test', routeHandler)
  app.get('/test/:id', routeHandler)
  app.ready()
  teardown(async () => {
    await app.close()
    const { exporters } = app.openTelemetry
    exporters.forEach(exporter => {
      if (exporter.constructor.name === 'InMemorySpanExporter') {
        exporter.reset()
      }
    })
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

  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }, handler, test.after)

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
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
  deepEqual(resource.attributes['service.name'], 'test-service')
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

  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }, handler, test.after)

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
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
  deepEqual(resource.attributes['service.name'], 'test-service')
  deepEqual(resource.attributes['service.version'], '1.0.0')
})

test('request should add attribute to a span', async () => {
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
  }, handler, test.after)

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
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
  deepEqual(resource.attributes['service.name'], 'test-service')
  deepEqual(resource.attributes['service.version'], '1.0.0')
})

test('should be able to set the W3C trace context', async () => {
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
  }, handler, test.after)

  const response = await app.inject(injectArgs)
  // see: https://www.w3.org/TR/trace-context/#design-overview
  ok(response.headers.traceparent)
})

test('should trace a request that fails', async () => {
  const handler = async (request, reply) => {
    throw new Error('booooom!!!')
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }, handler, test.after)

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
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
  equal(resource.attributes['service.name'], 'test-service')
  equal(resource.attributes['service.version'], '1.0.0')
})

test('if no exporter is configured, should default to console', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0'
  }, handler, test.after)

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  equal(exporter.constructor.name, 'ConsoleSpanExporter')
})

test('should configure OTLP correctly', async () => {
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
  }, handler, test.after)

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  equal(exporter.constructor.name, 'OTLPTraceExporter')
  equal(exporter.url, 'http://localhost:4317')
})

test('should configure Zipkin correctly', async () => {
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
  }, handler, test.after)

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  equal(exporter.constructor.name, 'ZipkinExporter')
  equal(exporter._urlStr, 'http://localhost:9876')
})

test('wrong exporter is configured, should default to console', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'wrong-exporter'
    }
  }, handler, test.after)

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  equal(exporter.constructor.name, 'ConsoleSpanExporter')
})

test('should not trace if the operation is skipped', async () => {
  const handler = async (request, reply) => {
    return { foo: 'bar' }
  }

  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    skip: [{
      path: '/documentation/json',
      method: 'GET'
    }],
    exporter: {
      type: 'memory'
    }
  }, handler, test.after)

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

test('should not put the URL param in path', async () => {
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

  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }, handler, test.after)

  await app.inject(injectArgs)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const span = finishedSpans[0]
  equal(span.kind, SpanKind.SERVER)
  equal(span.name, 'GET /test/{id}')
  equal(span.status.code, SpanStatusCode.OK)
  equal(span.attributes['http.request.method'], 'GET')
  equal(span.attributes['url.path'], '/test/{id}')
  equal(span.attributes['http.response.status_code'], 200)
  equal(span.attributes['url.scheme'], 'http')
  equal(span.attributes['server.address'], 'test')
  const resource = span.resource
  equal(resource.attributes['service.name'], 'test-service')
  equal(resource.attributes['service.version'], '1.0.0')
})

test('should configure an exporter as an array', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: [{
      type: 'otlp',
      options: {
        url: 'http://localhost:4317'
      }
    }]
  }, handler, test.after)
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  equal(exporter.constructor.name, 'OTLPTraceExporter')
  equal(exporter.url, 'http://localhost:4317')
})

test('should use multiple exporters and sent traces to all the exporters', async () => {
  const handler = async (request, reply) => {
    return {}
  }
  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: [{
      type: 'memory'
    }, {
      type: 'memory'
    }]
  }, handler, test.after)
  const { exporters } = app.openTelemetry

  await app.inject(injectArgs)

  const finishedSpans0 = exporters[0].getFinishedSpans()
  equal(finishedSpans0.length, 1)
  const span0 = finishedSpans0[0]
  equal(span0.name, 'GET /test')
  equal(span0.status.code, SpanStatusCode.OK)

  const finishedSpans1 = exporters[1].getFinishedSpans()
  equal(finishedSpans1.length, 1)
  const span1 = finishedSpans1[0]
  equal(span1.name, 'GET /test')
  equal(span1.status.code, SpanStatusCode.OK)
})
