import { SpanKind } from '@opentelemetry/api'
import { deepEqual, equal, ok } from 'node:assert'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime, prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'
import { findParentSpan, findSpanWithParentWithId, parseNDJson } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

async function getSpans (spanPaths) {
  const spans = await parseNDJson(spanPaths)
  return spans
}
const getAttributesForResource = resource => {
  return resource._rawAttributes.reduce((acc, attr) => {
    acc[attr[0]] = attr[1]
    return acc
  }, {})
}

const containsAttributeWithValue = (resource, key, value) => {
  const attributes = getAttributesForResource(resource)
  if (!attributes) {
    return false
  }
  if (attributes[key] === value) {
    return true
  }
  return false
}

test('configure telemetry correctly with a node app', async t => {
  const app = await createRuntime(t, 'node-api-with-telemetry', false, false, 'platformatic.json')
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request
  const { statusCode } = await request(`${url}/test`, {
    method: 'GET'
  })
  equal(statusCode, 200)
  await sleep(500)
  const spans = await getSpans(spansPath)

  equal(spans.length, 1)

  const [span] = spans
  equal(span.kind, SpanKind.SERVER)
  // these asserts will fail when this will be fixed
  // https://github.com/open-telemetry/opentelemetry-js/issues/5103
  equal(span.attributes['http.method'], 'GET')
  equal(span.attributes['http.scheme'], 'http')
  equal(span.attributes['http.target'], '/test')

  const resourceAttributes = getAttributesForResource(span.resource)
  deepEqual(resourceAttributes['service.name'], 'test-service-api')
})

test('configure telemetry correctly with a express app', async t => {
  const app = await createRuntime(t, 'express-api-with-telemetry', false, false, 'platformatic.json')
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/test`, {
    method: 'GET'
  })
  equal(statusCode, 200)
  await sleep(500)
  const spans = await getSpans(spansPath)

  equal(spans.length, 1)

  const [span] = spans
  equal(span.kind, SpanKind.SERVER)
  // these asserts will fail when this will be fixed
  // https://github.com/open-telemetry/opentelemetry-js/issues/5103
  equal(span.attributes['http.method'], 'GET')
  equal(span.attributes['http.scheme'], 'http')
  equal(span.attributes['http.target'], '/test')

  const resourceAttributes = getAttributesForResource(span.resource)
  deepEqual(resourceAttributes['service.name'], 'test-service-api')
})

test('configure telemetry correctly with a composer + node app', async t => {
  const app = await createRuntime(t, 'composer-node', false, false, 'platformatic.json')
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/node`, {
    method: 'GET'
  })
  equal(statusCode, 200)
  await sleep(500)
  const spans = await getSpans(spansPath)

  // We can have spurious span (like the one from the composr to applications) so we need to filter
  // the one for the actual call
  const spanComposerServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-composer')
    }
    return false
  })

  const spanComposerClient = spans.find(span => {
    if (span.kind === SpanKind.CLIENT) {
      return (
        containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-composer') &&
        span.attributes['url.full'] === 'http://node.plt.local/node'
      )
    }
    return false
  })
  console.log(spanComposerClient)

  const spanNodeServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-node')
    }
    return false
  })

  // They have to share the same traceId
  const traceId = spanComposerServer.traceId
  equal(spanComposerClient.traceId, traceId)
  equal(spanNodeServer.traceId, traceId)

  // The parent-child relationships are correct
  equal(spanComposerServer.id, spanComposerClient.parentSpanContext.spanId)
  equal(spanComposerClient.id, spanNodeServer.parentSpanContext.spanId)
})

test('configure telemetry correctly with a composer + node + fastify', async t => {
  // composer -> fastify -> node
  const app = await createRuntime(t, 'composer-node-fastify', false, true, 'platformatic.json')
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/fastify/node`, {
    method: 'GET'
  })
  equal(statusCode, 200)
  await sleep(500)
  const spans = await getSpans(spansPath)

  const spanComposerServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-composer')
    }
    return false
  })

  const traceId = spanComposerServer.traceId

  const spanComposerClient = spans.find(span => {
    if (span.kind === SpanKind.CLIENT) {
      return (
        containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-composer') &&
        span.attributes['url.full'] === 'http://fastify.plt.local/fastify/node' &&
        span.traceId === traceId
      )
    }
    return false
  })

  const spanFastifyServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return (
        containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-fastify') && span.traceId === traceId
      )
    }
    return false
  })

  const spanFastifyClient = spans.find(span => {
    if (span.kind === SpanKind.CLIENT) {
      return (
        containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-fastify') &&
        span.attributes['url.full'] === 'http://node.plt.local/' &&
        span.traceId === traceId
      )
    }
    return false
  })

  const spanNodeServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-node') && span.traceId === traceId
    }
    return false
  })

  // check the spans chain
  equal(spanComposerClient.traceId, traceId)
  equal(spanComposerClient.parentSpanContext.spanId, spanComposerServer.id)

  equal(spanFastifyServer.traceId, traceId)
  equal(spanFastifyServer.parentSpanContext.spanId, spanComposerClient.id)

  equal(spanFastifyClient.traceId, traceId)
  equal(spanFastifyClient.parentSpanContext.spanId, spanFastifyServer.id)

  equal(spanNodeServer.traceId, traceId)
  equal(spanNodeServer.parentSpanContext.spanId, spanFastifyClient.id)
})

test('configure telemetry correctly with a composer + next', async t => {
  // composer -> next -> fastify
  //                  -> node (via http)
  //
  // We need to be in production mode to be in the same runtime
  const { runtime, root } = await prepareRuntime(t, 'composer-next-node-fastify', true, 'platformatic.json')

  // build next
  const cliPath = join(import.meta.dirname, '../../wattpm', 'bin/cli.js')
  const { execa } = await import('execa')
  await execa('node', [cliPath, 'build'], {
    cwd: root
  })

  const url = await startRuntime(t, runtime, false)

  const spansPath = join(root, 'spans.log')

  const { statusCode } = await request(`${url}/next`, {
    method: 'GET'
  })
  equal(statusCode, 200)

  await sleep(500)
  const spans = await getSpans(spansPath)

  // Check that all the spans are part of the same trace
  const traceId = spans[0].traceId
  for (const span of spans) {
    equal(span.traceId, traceId)
  }

  const spanComposerServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-composer')
    }
    return false
  })

  const spanComposerClient = spans.find(span => {
    if (span.kind === SpanKind.CLIENT) {
      return (
        containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-composer') &&
        span.attributes['url.full'] === 'http://next.plt.local/next' &&
        span.traceId === traceId
      )
    }
    return false
  })

  // Next also produces some "type 0" internal spans, that are not relevant for this test
  // so we start from the last ones (node and fastify server span) and go backward
  // back to the composer one
  const spanNodeServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-node') && span.traceId === traceId
    }
    return false
  })
  const spanNextClientNode = findParentSpan(spans, spanNodeServer, SpanKind.CLIENT, 'GET http://node.plt.local/')
  ok(!!spanNextClientNode)
  const spanNextServer = findSpanWithParentWithId(spans, spanNextClientNode, spanComposerClient.id)
  equal(spanNextClientNode.traceId, traceId)
  equal(spanNextServer.traceId, traceId)

  const spanFastifyServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return (
        containsAttributeWithValue(span.resource, 'service.name', 'test-runtime-fastify') && span.traceId === traceId
      )
    }
    return false
  })
  const spanNextClientFastify = findParentSpan(
    spans,
    spanFastifyServer,
    SpanKind.CLIENT,
    'GET http://fastify.plt.local/'
  )
  const spanNextServer2 = findSpanWithParentWithId(spans, spanNextClientFastify, spanComposerClient.id)
  equal(spanNextServer.id, spanNextServer2.id) // Must be the same span
  equal(spanNextClientNode.traceId, traceId)
  equal(spanNextServer.traceId, traceId)

  // check the spans chain back from next to composer call
  equal(spanNextServer.parentSpanContext.spanId, spanComposerClient.id)
  equal(spanComposerClient.parentSpanContext.spanId, spanComposerServer.id)
  equal(spanComposerClient.traceId, traceId)
})

test('configure telemetry correctly with a express app and additional express instrumentation', async t => {
  const app = await createRuntime(t, 'express-api-with-additional-instrumenters', false, true, 'platformatic.json')
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/test`, {
    method: 'GET'
  })
  equal(statusCode, 200)
  await sleep(500)

  const spans = await getSpans(spansPath)
  const expressSpans = spans.filter(span => span.instrumentationScope.name === '@opentelemetry/instrumentation-express')
  const httpSpans = spans.filter(span => span.instrumentationScope.name === '@opentelemetry/instrumentation-http')

  // we just check that we have spans from the additiona instrumentation and all the spans are on the smae trace:
  equal(httpSpans.length, 1)
  equal(expressSpans.length, 4)

  const traceId = spans[0].traceId

  // All spans should be part of the same trace
  for (const span of spans) {
    equal(span.traceId, traceId)
  }
})

test('configure telemetry correctly with a ESM express app and additional express instrumentation', async t => {
  const app = await createRuntime(t, 'express-api-with-additional-instrumenters-esm', false, true, 'platformatic.json')
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/test`, {
    method: 'GET'
  })
  equal(statusCode, 200)
  await sleep(500)

  const spans = await getSpans(spansPath)
  console.log(spans)
  const expressSpans = spans.filter(span => span.instrumentationScope.name === '@opentelemetry/instrumentation-express')
  const httpSpans = spans.filter(span => span.instrumentationScope.name === '@opentelemetry/instrumentation-http')

  // we just check that we have spans from the additiona instrumentation and all the spans are on the smae trace:
  equal(httpSpans.length, 1)
  equal(expressSpans.length, 4)

  const traceId = spans[0].traceId

  // All spans should be part of the same trace
  for (const span of spans) {
    equal(span.traceId, traceId)
  }
})
