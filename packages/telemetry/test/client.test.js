'use strict'

const { test } = require('tap')
const fastify = require('fastify')
const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const telemetryPlugin = require('../lib/telemetry')
const { PlatformaticContext } = require('../lib/platformatic-context')
const { fastifyTextMapGetter } = require('../lib/fastify-text-map')

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

test('should add the propagation headers correctly, new propagation started', async ({ equal, same, teardown }) => {
  const handler = async (request, reply) => {
    return { foo: 'bar' }
  }

  const app = await setupApp({
    serviceName: 'test-service',
    exporter: {
      type: 'memory'
    }
  }, handler, teardown)

  const { startSpanClient } = app.openTelemetry

  const url = 'http://localhost:3000/test'
  const { span, telemetryHeaders } = startSpanClient(url, 'GET')

  const spanId = span._spanContext.spanId
  const traceId = span._spanContext.traceId
  same(telemetryHeaders, {
    traceparent: `00-${traceId}-${spanId}-01`
  })
})

test('should add the propagation headers correctly, with propagation already started', async ({ equal, same, teardown }) => {
  const traceId = '5e994e8fb53b27c91dcd2fec22771d15'
  const spanId = '166f3ab30f21800b'
  const traceparent = `00-${traceId}-${spanId}-01`

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

  const { startSpanClient } = app.openTelemetry

  const url = 'http://localhost:3000/test'
  const incomingHeaders = {
    host: 'test',
    traceparent
  }
  const { propagator } = app.openTelemetry
  const context = propagator.extract(new PlatformaticContext(), { headers: incomingHeaders }, fastifyTextMapGetter)

  const { span, telemetryHeaders } = startSpanClient(url, 'GET', context)

  const spanId2 = span._spanContext.spanId
  const traceId2 = span._spanContext.traceId

  // We preserved the tracedId
  same(traceId, traceId2)
  same(telemetryHeaders, {
    traceparent: `00-${traceId}-${spanId2}-01`
  })
})

test('should trace a client request', async ({ equal, same, teardown }) => {
  let receivedHeaders = null
  const handler = async (request, reply) => {
    receivedHeaders = request.headers
    return { foo: 'bar' }
  }

  const app = await setupApp({
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }, handler, teardown)

  const { startSpanClient, endSpanClient } = app.openTelemetry

  const url = 'http://localhost:3000/test'

  const { propagator } = app.openTelemetry
  const context = propagator.extract(new PlatformaticContext(), { headers: {} }, fastifyTextMapGetter)

  const { span, telemetryHeaders } = startSpanClient(url, 'GET', context)
  const args = {
    method: 'GET',
    url: '/test',
    headers: {
      ...telemetryHeaders
    }
  }

  const response = await app.inject(args)
  endSpanClient(span, response)

  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 2)
  // We have two one for the client and one for the server
  const spanServer = finishedSpans[0]
  equal(spanServer.name, 'GET /test')
  equal(spanServer.kind, SpanKind.SERVER)
  equal(spanServer.status.code, SpanStatusCode.OK)
  equal(spanServer.attributes['http.request.method'], 'GET')
  equal(spanServer.attributes['url.path'], '/test')
  equal(spanServer.attributes['http.response.status_code'], 200)

  const spanClient = finishedSpans[1]
  equal(spanClient.name, 'GET http://localhost:3000/test')
  equal(spanClient.kind, SpanKind.CLIENT)
  equal(spanClient.status.code, SpanStatusCode.OK)
  equal(spanClient.attributes['url.full'], 'http://localhost:3000/test')
  equal(spanClient.attributes['http.response.status_code'], 200)
  equal(spanClient.attributes['server.port'], 3000)
  equal(spanClient.attributes['server.address'], 'localhost')
  equal(spanClient.attributes['url.path'], '/test')

  // The traceparent header is added to the request and propagated to the server
  equal(receivedHeaders.traceparent, telemetryHeaders.traceparent)
})

test('should trace a client request failing', async ({ equal, same, teardown }) => {
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

  const { startSpanClient, endSpanClient } = app.openTelemetry

  const { propagator } = app.openTelemetry
  const context = propagator.extract(new PlatformaticContext(), { headers: {} }, fastifyTextMapGetter)

  const url = 'http://localhost:3000/test'
  const { span, telemetryHeaders } = startSpanClient(url, 'GET', context)
  const args = {
    method: 'GET',
    url: '/wrong',
    headers: telemetryHeaders
  }
  const response = await app.inject(args)
  endSpanClient(span, response)

  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 2)
  // We have two one for the client and one for the server
  const spanServer = finishedSpans[0]
  equal(spanServer.name, 'GET /wrong')
  equal(spanServer.kind, SpanKind.SERVER)
  equal(spanServer.status.code, SpanStatusCode.ERROR)
  equal(spanServer.attributes['http.request.method'], 'GET')
  equal(spanServer.attributes['url.path'], '/wrong')
  equal(spanServer.attributes['http.response.status_code'], 404)

  const spanClient = finishedSpans[1]
  equal(spanClient.name, 'GET http://localhost:3000/test')
  equal(spanClient.kind, SpanKind.CLIENT)
  equal(spanClient.status.code, SpanStatusCode.ERROR)
  equal(spanClient.attributes['url.full'], 'http://localhost:3000/test')
  equal(spanClient.attributes['http.response.status_code'], 404)
})

test('should trace a client request failing (no HTTP error)', async ({ equal, same, teardown }) => {
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

  const { startSpanClient, endSpanClient, setErrorInSpanClient } = app.openTelemetry

  const url = 'http://localhost:3000/test'
  const { span } = startSpanClient(url, 'GET')
  try {
    throw new Error('KABOOM!!!')
  } catch (err) {
    setErrorInSpanClient(span, err)
  } finally {
    endSpanClient(span)
  }

  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)

  const spanClient = finishedSpans[0]
  equal(spanClient.name, 'GET http://localhost:3000/test')
  equal(spanClient.status.code, SpanStatusCode.ERROR)
  equal(spanClient.attributes['url.full'], 'http://localhost:3000/test')
  equal(spanClient.attributes['error.name'], 'Error')
  equal(spanClient.attributes['error.message'], 'KABOOM!!!')
  equal(spanClient.attributes['error.stack'].includes('Error: KABOOM!!!'), true)
})

test('should not add the query in span name', async ({ equal, same, teardown }) => {
  const handler = async (request, reply) => {
    return { foo: 'bar' }
  }

  const app = await setupApp({
    serviceName: 'test-service',
    exporter: {
      type: 'memory'
    }
  }, handler, teardown)

  const { startSpanClient } = app.openTelemetry

  const url = 'http://localhost:3000/test?foo=bar'
  const { span } = startSpanClient(url, 'GET')
  same(span.name, 'GET http://localhost:3000/test')
})

test('should ignore the skipped operations', async ({ equal, same, ok, teardown }) => {
  const handler = async (request, reply) => {
    return { foo: 'bar' }
  }

  const app = await setupApp({
    serviceName: 'test-service',
    skip: ['POST/skipme'],
    exporter: {
      type: 'memory'
    }
  }, handler, teardown)

  const { startSpanClient } = app.openTelemetry

  const url = 'http://localhost:3000/skipme'
  const ret = startSpanClient(url, 'POST')
  // no spam should be created
  ok(!ret)
})
