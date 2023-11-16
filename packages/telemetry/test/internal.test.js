'use strict'

const { test } = require('node:test')
const { deepEqual, equal } = require('node:assert')
const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const { PlatformaticContext } = require('../lib/platformatic-context')
const { fastifyTextMapGetter } = require('../lib/fastify-text-map')
const { setupApp } = require('./helper')

test('start and ends an internal span', async () => {
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
  }, handler, test.after)

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
  deepEqual(span._spanContext.traceId, traceId)
  equal(span._ended, false)
  deepEqual(span.attributes, attributes)
  endInternalSpan(span)
  equal(span._ended, true)

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const [finishedSpan] = finishedSpans
  deepEqual(finishedSpan.name, 'TEST')
  deepEqual(finishedSpan.kind, SpanKind.INTERNAL)
  deepEqual(finishedSpan.status.code, SpanStatusCode.OK)
})

test('start and ends an internal span with no parent context and no attributes', async () => {
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

  const { startInternalSpan, endInternalSpan } = app.openTelemetry

  const span = startInternalSpan('TEST')
  equal(span._ended, false)
  deepEqual(span.attributes, {})
  endInternalSpan(span)
  equal(span._ended, true)

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const [finishedSpan] = finishedSpans
  deepEqual(finishedSpan.name, 'TEST')
  deepEqual(finishedSpan.kind, SpanKind.INTERNAL)
  deepEqual(finishedSpan.status.code, SpanStatusCode.OK)
})

test('start and ends an internal span with error', async () => {
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
  }, handler, test.after)

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
  deepEqual(span._spanContext.traceId, traceId)
  deepEqual(span._ended, false)
  deepEqual(span.attributes, attributes)
  const error = new Error('test error')
  endInternalSpan(span, error)
  deepEqual(span._ended, true)

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  const finishedSpans = exporter.getFinishedSpans()
  deepEqual(finishedSpans.length, 1)
  const [finishedSpan] = finishedSpans
  deepEqual(finishedSpan.name, 'TEST')
  deepEqual(finishedSpan.kind, SpanKind.INTERNAL)
  deepEqual(finishedSpan.status.code, SpanStatusCode.ERROR)
  deepEqual(finishedSpan.status.message, 'test error')
})
