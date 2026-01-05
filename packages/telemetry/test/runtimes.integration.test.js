import { deepEqual, equal } from 'node:assert'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'
import { startOTEL } from './otelserver/index.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

let received = []
let otelServer
let otelServerURL

test.before(async () => {
  otelServer = await startOTEL(test, resourceSpans => {
    for (const resourceSpan of resourceSpans) {
      const application = resourceSpan.resource.attributes.find(attr => attr.key === 'service.name')
      const applicationName = application.value.stringValue

      received.push(
        ...resourceSpan.scopeSpans.map(scopeSpan => {
          return {
            scope: scopeSpan.scope,
            spans: scopeSpan.spans.map(span => {
              return {
                ...span,
                applicationName
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
  const applicationUrl = serverSpan.attributes.find(attr => attr.key === 'http.url')
  equal(applicationUrl.value.stringValue, `${url}/`)
})

test('configure telemetry correctly with a gateway + next - integration test', async t => {
  // gateway -> next -> fastify
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
  const cliPath = join(import.meta.dirname, '../../wattpm', 'bin/cli.js')
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

  const spanGatewayServer = allSpans.find(span => {
    if (span.kind === 2) {
      // Server
      return span.applicationName === 'test-runtime-composer'
    }
    return false
  })

  const spanGatewayClient = allSpans.find(span => {
    if (span.kind === 3) {
      // Client
      // In production mode, Next.js uses actual localhost IP instead of service mesh hostname
      return (
        span.applicationName === 'test-runtime-composer' &&
        span.attributes['url.full']?.stringValue?.includes('/next') &&
        span.attributes['url.full']?.stringValue?.startsWith('http://127.0.0.1:')
      )
    }
    return false
  })

  // Next also produces some "type 0" internal spans, that are not relevant for this test
  // Find Next.js CLIENT span to node service by url.full attribute
  const spanNextClientNode = allSpans.find(span => {
    if (span.kind === 3) { // CLIENT
      return (
        span.applicationName === 'test-runtime-next' &&
        span.attributes['url.full']?.stringValue === 'http://node.plt.local/'
      )
    }
    return false
  })

  const spanNextServer = findSpanWithParentWithId(allSpans, spanNextClientNode, spanGatewayClient.spanId)

  // Find Next.js CLIENT span to fastify service by url.full attribute
  const spanNextClientFastify = allSpans.find(span => {
    if (span.kind === 3) { // CLIENT
      return (
        span.applicationName === 'test-runtime-next' &&
        span.attributes['url.full']?.stringValue === 'http://fastify.plt.local/'
      )
    }
    return false
  })
  const spanNextServer2 = findSpanWithParentWithId(allSpans, spanNextClientFastify, spanGatewayClient.spanId)

  equal(spanNextServer.id, spanNextServer2.id) // Must be the same span
  equal(spanNextClientNode.traceId, traceId)

  // check the spans chain back from next to gateway call
  equal(spanNextServer.parentSpanId, spanGatewayClient.spanId)
  equal(spanGatewayClient.parentSpanId, spanGatewayServer.spanId)
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
  const libraries = [...new Set(received.map(r => r.scope).map(s => s.name))].sort()
  deepEqual(libraries, ['@opentelemetry/instrumentation-express', '@opentelemetry/instrumentation-http'])

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
