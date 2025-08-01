'use strict'

const { equal, deepEqual } = require('node:assert')
const { resolve, join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { setTimeout: sleep } = require('node:timers/promises')
const { startOTEL } = require('./otelserver')
const { setFixturesDir, prepareRuntime, startRuntime } = require('../../basic/test/helper.js')

process.setMaxListeners(100)
setFixturesDir(resolve(__dirname, './fixtures'))

let received = []
let otelServer
let otelServerURL

test.before(async () => {
  otelServer = await startOTEL(test, resourceSpans => {
    for (const resourceSpan of resourceSpans) {
      const service = resourceSpan.resource.attributes.find(attr => attr.key === 'service.name')
      const serviceName = service.value.stringValue

      received.push(
        ...resourceSpan.scopeSpans.map(scopeSpan => {
          return {
            scope: scopeSpan.scope,
            spans: scopeSpan.spans.map(span => {
              return {
                ...span,
                serviceName
              }
            })
          }
        })
      )
    }
  })
  otelServerURL = await otelServer.listen({ port: 0, host: '127.0.0.1' })
})

test.after(async () => {
  otelServer.close()
})

test.beforeEach(async () => {
  received = []
})

const findParentSpan = (spans, startSpan, type, name) => {
  let currentSpan = startSpan
  while (currentSpan) {
    const parentSpan = spans.find(span => span.spanId === currentSpan.parentSpanId)
    if (parentSpan && parentSpan.kind === type && parentSpan.name === name) {
      return parentSpan
    }
    currentSpan = parentSpan
  }
}

const findSpanWithParentWithId = (spans, startSpan, id) => {
  let currentSpan = startSpan
  while (currentSpan) {
    const parentSpan = spans.find(span => span.spanId === currentSpan.parentSpanId)
    if (parentSpan && parentSpan.spanId === id) {
      return currentSpan
    }
    currentSpan = parentSpan
  }
}

// Changes the telemetry config to point to the otel server
const setupTelemetryServer = (root, config, args) => {
  const currentTelemetry = config.telemetry
  const newTelemetry = {
    ...currentTelemetry,
    exporter: {
      type: 'otlp',
      options: {
        url: `${otelServerURL}/v1/traces`
      },
      processor: 'simple' // this is used only in tests. Otherwise for OTLP we defaults to batch
    }
  }
  config.telemetry = newTelemetry
}

test('configure telemetry correctly with a node app - integration test', async t => {
  const { runtime } = await prepareRuntime(
    t,
    'node-api-with-telemetry',
    true, // we are interested in telemetry only in production mode
    'platformatic.json',
    setupTelemetryServer
  )

  const url = await startRuntime(t, runtime)

  // Test request
  const { statusCode } = await request(`${url}`, {
    method: 'GET'
  })

  await sleep(500)
  equal(statusCode, 200)
  equal(received.length, 1)
  const scope = received[0].scope
  equal(scope.name, '@opentelemetry/instrumentation-http')

  const spans = received[0].spans
  equal(spans.length, 1)
  const serverSpan = spans[0]
  equal(serverSpan.kind, 2)
  const serviceUrl = serverSpan.attributes.find(attr => attr.key === 'http.url')
  equal(serviceUrl.value.stringValue, `${url}/`)
})

test('configure telemetry correctly with a composer + next - integration test', async t => {
  // composer -> next -> fastify
  //                  -> node (via http)
  //
  // We need to be in production mode to be in the same runtime
  const { runtime, root } = await prepareRuntime(
    t,
    'composer-next-node-fastify',
    true,
    'platformatic.json',
    setupTelemetryServer
  )

  // build next
  const cliPath = join(__dirname, '../../wattpm', 'bin/wattpm.js')
  const { execa } = await import('execa')
  await execa('node', [cliPath, 'build'], { cwd: root })

  const url = await startRuntime(t, runtime)

  const { statusCode } = await request(`${url}/next`, {
    method: 'GET'
  })
  equal(statusCode, 200)

  await sleep(1000)

  const allSpans = received
    .map(r => r.spans)
    .flat()
    .map(s => {
      const spanId = s.spanId.toString('hex')
      const parentSpanId = s.parentSpanId?.toString('hex') || null
      return {
        ...s,
        traceId: s.traceId.toString('hex'),
        spanId,
        parentSpanId,
        attributes: s.attributes.reduce((acc, attr) => {
          acc[attr.key] = attr.value
          return acc
        }, {})
      }
    })
  const allSpanIds = allSpans.map(s => s.spanId.toString())
  const traceId = allSpans[0].traceId

  // All spans should be part of the same trace
  for (const span of allSpans) {
    equal(span.traceId, traceId)
  }

  // Every parent span must exist in the trace
  for (const span of allSpans) {
    if (span.parentSpanId) {
      equal(allSpanIds.includes(span.parentSpanId), true)
    }
  }

  const spanComposerServer = allSpans.find(span => {
    if (span.kind === 2) {
      // Server
      return span.serviceName === 'test-runtime-composer'
    }
    return false
  })

  const spanComposerClient = allSpans.find(span => {
    if (span.kind === 3) {
      // Client
      return (
        span.serviceName === 'test-runtime-composer' &&
        span.attributes['url.full'].stringValue === 'http://next.plt.local/next'
      )
    }
    return false
  })

  // Next also produces some "type 0" internal spans, that are not relevant for this test
  // so we start from the last ones (node and fastify server span) and go backward
  // to the composer one
  const spanNodeServer = allSpans.find(span => {
    if (span.kind === 2) {
      return span.serviceName === 'test-runtime-node'
    }
    return false
  })

  const spanNextClientNode = findParentSpan(allSpans, spanNodeServer, 3, 'GET http://node.plt.local/')
  const spanNextServer = findSpanWithParentWithId(allSpans, spanNextClientNode, spanComposerClient.spanId)
  const spanFastifyServer = allSpans.find(span => {
    if (span.kind === 2) {
      return span.serviceName === 'test-runtime-fastify'
    }
    return false
  })
  const spanNextClientFastify = findParentSpan(allSpans, spanFastifyServer, 3, 'GET http://fastify.plt.local/')
  const spanNextServer2 = findSpanWithParentWithId(allSpans, spanNextClientFastify, spanComposerClient.spanId)

  equal(spanNextServer.id, spanNextServer2.id) // Must be the same span
  equal(spanNextClientNode.traceId, traceId)

  // check the spans chain back from next to composer call
  equal(spanNextServer.parentId, spanComposerClient.id)
  equal(spanComposerClient.parentId, spanComposerServer.id)
})

test('configure telemetry correctly with a express app and additional express instrumentation', async t => {
  const { runtime } = await prepareRuntime(
    t,
    'express-api-with-additional-instrumenters',
    true, // we are interested in telemetry only in production mode
    'platformatic.json',
    setupTelemetryServer
  )

  const url = await startRuntime(t, runtime)
  const { statusCode } = await request(`${url}/test`, {
    method: 'GET'
  })
  equal(statusCode, 200)

  await sleep(500)

  // We check that we have received spans from the express instrumentation too and all the
  // spans are part of the same trace
  const libraires = [...new Set(received.map(r => r.scope).map(s => s.name))].sort()
  deepEqual(libraires, ['@opentelemetry/instrumentation-express', '@opentelemetry/instrumentation-http'])

  const allSpans = received
    .map(r => r.spans)
    .flat()
    .map(s => {
      const spanId = s.spanId.toString('hex')
      const parentSpanId = s.parentSpanId?.toString('hex') || null
      return {
        ...s,
        traceId: s.traceId.toString('hex'),
        spanId,
        parentSpanId
      }
    })

  const traceId = allSpans[0].traceId
  // All spans should be part of the same trace
  for (const span of allSpans) {
    equal(span.traceId, traceId)
  }
})
