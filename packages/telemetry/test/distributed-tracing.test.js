import { SpanKind } from '@opentelemetry/api'
import { equal, ok } from 'node:assert'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { FileWatcher } from '@platformatic/foundation'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'
import { parseNDJson } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

async function getSpans (spanPaths) {
  const spans = await parseNDJson(spanPaths)
  return spans
}

async function waitForSpans (spansPath, timeout = 5000) {
  const { promise, resolve } = Promise.withResolvers()
  const watcher = new FileWatcher({ path: dirname(spansPath) })

  const timeoutId = setTimeout(() => {
    watcher.stopWatching()
    resolve()
  }, timeout)

  watcher.once('update', () => {
    clearTimeout(timeoutId)
    watcher.stopWatching()
    resolve()
  })

  watcher.startWatching()
  await promise
}

const getServiceName = resource => {
  const attr = resource._rawAttributes.find(a => a[0] === 'service.name')
  return attr ? attr[1] : null
}

test('distributed tracing - 4 service chain with direct fetch calls', async t => {
  // This test verifies that distributed tracing works correctly across a chain of services:
  // gateway -> service-a -> service-b -> service-c
  //
  // Each service (except service-c) makes a direct fetch() call to the next service
  // using the .plt.local domain. The test verifies that:
  // 1. All spans are part of the same trace (same traceId)
  // 2. Parent-child relationships are correct across service boundaries
  // 3. Both SERVER and CLIENT spans are created for each hop

  const app = await createRuntime(t, 'distributed-tracing-chain', false, false, 'platformatic.json')
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Make a request through the chain: gateway -> service-a -> service-b -> service-c
  const { statusCode, body } = await request(`${url}/chain`, {
    method: 'GET'
  })
  equal(statusCode, 200)

  const data = await body.json()
  equal(data.service, 'service-a')
  equal(data.downstream.service, 'service-b')
  equal(data.downstream.downstream.service, 'service-c')

  // Wait for spans to be written using file watcher
  await waitForSpans(spansPath)

  const spans = await getSpans(spansPath)

  // We expect 7 spans total:
  // 1. gateway SERVER (incoming request to /chain)
  // 2. gateway CLIENT (proxy request to service-a)
  // 3. service-a SERVER (incoming request from gateway)
  // 4. service-a CLIENT (fetch to service-b)
  // 5. service-b SERVER (incoming request from service-a)
  // 6. service-b CLIENT (fetch to service-c)
  // 7. service-c SERVER (incoming request from service-b)
  // Exactly 7 spans - any more would indicate duplicate spans (e.g., from missing traceparent check)
  equal(spans.length, 7, `Expected exactly 7 spans, got ${spans.length}`)

  // All spans should have the same traceId
  const traceId = spans[0].traceId
  for (const span of spans) {
    equal(span.traceId, traceId, `Span ${span.name} should have traceId ${traceId}, got ${span.traceId}`)
  }

  // Find specific spans by their characteristics
  const gatewayServerSpan = spans.find(span =>
    span.kind === SpanKind.SERVER &&
    getServiceName(span.resource)?.includes('gateway')
  )
  ok(gatewayServerSpan, 'Should find gateway SERVER span')

  const gatewayClientSpan = spans.find(span =>
    span.kind === SpanKind.CLIENT &&
    getServiceName(span.resource)?.includes('gateway') &&
    span.attributes['url.full']?.includes('service-a.plt.local')
  )
  ok(gatewayClientSpan, 'Should find gateway CLIENT span')
  ok(gatewayClientSpan.name.includes('service-a.plt.local'), 'gateway CLIENT span name should include target service')

  const serviceAServerSpan = spans.find(span =>
    span.kind === SpanKind.SERVER &&
    getServiceName(span.resource)?.includes('service-a')
  )
  ok(serviceAServerSpan, 'Should find service-a SERVER span')

  const serviceAClientSpan = spans.find(span =>
    span.kind === SpanKind.CLIENT &&
    getServiceName(span.resource)?.includes('service-a') &&
    span.attributes['url.full']?.includes('service-b.plt.local')
  )
  ok(serviceAClientSpan, 'Should find service-a CLIENT span')
  ok(serviceAClientSpan.name.includes('service-b.plt.local'), 'service-a CLIENT span name should include target service')

  const serviceBServerSpan = spans.find(span =>
    span.kind === SpanKind.SERVER &&
    getServiceName(span.resource)?.includes('service-b')
  )
  ok(serviceBServerSpan, 'Should find service-b SERVER span')

  const serviceBClientSpan = spans.find(span =>
    span.kind === SpanKind.CLIENT &&
    getServiceName(span.resource)?.includes('service-b') &&
    span.attributes['url.full']?.includes('service-c.plt.local')
  )
  ok(serviceBClientSpan, 'Should find service-b CLIENT span')
  ok(serviceBClientSpan.name.includes('service-c.plt.local'), 'service-b CLIENT span name should include target service')

  const serviceCServerSpan = spans.find(span =>
    span.kind === SpanKind.SERVER &&
    getServiceName(span.resource)?.includes('service-c')
  )
  ok(serviceCServerSpan, 'Should find service-c SERVER span')

  // Verify no duplicate CLIENT spans (dual client hazard prevention)
  const clientSpans = spans.filter(s => s.kind === SpanKind.CLIENT)
  equal(clientSpans.length, 3, 'Should have exactly 3 CLIENT spans total')

  const clientSpansByService = clientSpans.reduce((acc, span) => {
    const service = getServiceName(span.resource)
    acc[service] = (acc[service] || 0) + 1
    return acc
  }, {})

  for (const [service, count] of Object.entries(clientSpansByService)) {
    equal(count, 1, `${service} should have exactly 1 CLIENT span, got ${count}`)
  }

  // Verify parent-child relationships
  // gateway CLIENT should be child of gateway SERVER
  equal(
    gatewayClientSpan.parentSpanContext?.spanId,
    gatewayServerSpan.id,
    'gateway CLIENT should be child of gateway SERVER'
  )

  // service-a SERVER should be child of gateway CLIENT
  equal(
    serviceAServerSpan.parentSpanContext?.spanId,
    gatewayClientSpan.id,
    'service-a SERVER should be child of gateway CLIENT'
  )

  // service-a CLIENT should be child of service-a SERVER
  equal(
    serviceAClientSpan.parentSpanContext?.spanId,
    serviceAServerSpan.id,
    'service-a CLIENT should be child of service-a SERVER'
  )

  // service-b SERVER should be child of service-a CLIENT
  equal(
    serviceBServerSpan.parentSpanContext?.spanId,
    serviceAClientSpan.id,
    'service-b SERVER should be child of service-a CLIENT'
  )

  // service-b CLIENT should be child of service-b SERVER
  equal(
    serviceBClientSpan.parentSpanContext?.spanId,
    serviceBServerSpan.id,
    'service-b CLIENT should be child of service-b SERVER'
  )

  // service-c SERVER should be child of service-b CLIENT
  equal(
    serviceCServerSpan.parentSpanContext?.spanId,
    serviceBClientSpan.id,
    'service-c SERVER should be child of service-b CLIENT'
  )
})

test('distributed tracing - all spans have correct instrumentationScope', async t => {
  const app = await createRuntime(t, 'distributed-tracing-chain', false, false, 'platformatic.json')
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  const { statusCode } = await request(`${url}/chain`, { method: 'GET' })
  equal(statusCode, 200)

  // Wait for spans to be written using file watcher
  await waitForSpans(spansPath)

  const spans = await getSpans(spansPath)

  // All spans should be from @platformatic/telemetry
  for (const span of spans) {
    equal(
      span.instrumentationScope?.name,
      '@platformatic/telemetry',
      `Span ${span.name} should have instrumentationScope @platformatic/telemetry`
    )
  }
})
