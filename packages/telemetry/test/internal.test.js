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
    const { exporters } = app.openTelemetry
    exporters.forEach(exporter => {
      if (exporter.constructor.name === 'InMemorySpanExporter') {
        exporter.reset()
      }
    })
  })
  return app
}

test('start and ends an internal span', async ({ equal, same, teardown }) => {
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

  const { startInternalSpan, endInternalSpan } = app.openTelemetry

  const incomingHeaders = {
    host: 'test',
    traceparent
  }
  const { propagator } = app.openTelemetry
  const context = propagator.extract(new PlatformaticContext(), { headers: incomingHeaders }, fastifyTextMapGetter)

  const attributes = {
    'test-attribute': 'test-value'
  }
  const span = startInternalSpan('TEST', context, attributes)
  same(span._spanContext.traceId, traceId)
  same(span._ended, false)
  same(span.attributes, attributes)
  endInternalSpan(span)
  same(span._ended, true)

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const [finishedSpan] = finishedSpans
  same(finishedSpan.name, 'TEST')
  same(finishedSpan.kind, SpanKind.INTERNAL)
  same(finishedSpan.status.code, SpanStatusCode.OK)
})

test('start and ends an internal span with no parent context and no attributes', async ({ equal, same, teardown }) => {
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

  const { startInternalSpan, endInternalSpan } = app.openTelemetry

  const span = startInternalSpan('TEST')
  same(span._ended, false)
  same(span.attributes, {})
  endInternalSpan(span)
  same(span._ended, true)

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const [finishedSpan] = finishedSpans
  same(finishedSpan.name, 'TEST')
  same(finishedSpan.kind, SpanKind.INTERNAL)
  same(finishedSpan.status.code, SpanStatusCode.OK)
})

test('start and ends an internal span with error', async ({ equal, same, teardown }) => {
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

  const { startInternalSpan, endInternalSpan } = app.openTelemetry

  const incomingHeaders = {
    host: 'test',
    traceparent
  }
  const { propagator } = app.openTelemetry
  const context = propagator.extract(new PlatformaticContext(), { headers: incomingHeaders }, fastifyTextMapGetter)

  const attributes = {
    'test-attribute': 'test-value'
  }
  const span = startInternalSpan('TEST', context, attributes)
  same(span._spanContext.traceId, traceId)
  same(span._ended, false)
  same(span.attributes, attributes)
  const error = new Error('test error')
  endInternalSpan(span, error)
  same(span._ended, true)

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const [finishedSpan] = finishedSpans
  same(finishedSpan.name, 'TEST')
  same(finishedSpan.kind, SpanKind.INTERNAL)
  same(finishedSpan.status.code, SpanStatusCode.ERROR)
  same(finishedSpan.status.message, 'test error')
})
