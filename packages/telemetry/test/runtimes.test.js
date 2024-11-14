'use strict'

const { equal, deepEqual } = require('node:assert')
const { resolve, join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { parseNDJson } = require('./helper.js')
const { setTimeout: sleep } = require('node:timers/promises')
const { SpanKind } = require('@opentelemetry/api')
const { findParentSpan, findSpanWithParentWithId } = require('./helper')

process.setMaxListeners(100)

let basicHelper

const getSpans = async (spanPaths) => {
  const spans = await parseNDJson(spanPaths)
  return spans
}

test.beforeEach(async () => {
  basicHelper = await import('../../basic/test/helper.js')
  const fixturesDir = resolve(__dirname, './fixtures')
  basicHelper.setFixturesDir(fixturesDir)
})

test('configure telemetry correctly with a node app', async t => {
  const app = await basicHelper.createRuntime(t,
    'node-api-with-telemetry',
    false,
    false,
    'platformatic.json'
  )
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/test`, {
    method: 'GET',
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

  const resource = span.resource
  deepEqual(resource._attributes['service.name'], 'test-service-api')
})

test('configure telemetry correctly with a express app', async t => {
  const app = await basicHelper.createRuntime(t,
    'express-api-with-telemetry',
    false,
    false,
    'platformatic.json'
  )
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/test`, {
    method: 'GET',
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

  const resource = span.resource
  deepEqual(resource._attributes['service.name'], 'test-service-api')
})

test('configure telemetry correctly with a composer + node app', async t => {
  const app = await basicHelper.createRuntime(t,
    'composer-node',
    false,
    false,
    'platformatic.json'
  )
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/node`, {
    method: 'GET',
  })
  equal(statusCode, 200)
  await sleep(500)
  const spans = await getSpans(spansPath)

  // We can have spurious span (like the one from the composr to services) so we need to filter
  // the one for the actual call
  const spanComposerServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return span.resource._attributes['service.name'] === 'test-runtime-composer'
    }
    return false
  })

  const spanComposerClient = spans.find(span => {
    if (span.kind === SpanKind.CLIENT) {
      return span.resource._attributes['service.name'] === 'test-runtime-composer' &&
        span.attributes['url.full'] === 'http://node.plt.local/node/'
    }
    return false
  })

  const spanNodeServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return span.resource._attributes['service.name'] === 'test-runtime-node'
    }
    return false
  })

  // They have to share the same traceId
  const traceId = spanComposerServer.traceId
  equal(spanComposerClient.traceId, traceId)
  equal(spanNodeServer.traceId, traceId)

  // The parent-child relationships are correct
  equal(spanComposerServer.id, spanComposerClient.parentId)
  equal(spanComposerClient.id, spanNodeServer.parentId)
})

test('configure telemetry correctly with a composer + node + fastify', async t => {
  // composer -> fastify -> node
  const app = await basicHelper.createRuntime(t,
    'composer-node-fastify',
    false,
    true,
    'platformatic.json'
  )
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/fastify/node`, {
    method: 'GET',
  })
  equal(statusCode, 200)
  await sleep(500)
  const spans = await getSpans(spansPath)

  const spanComposerServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return span.resource._attributes['service.name'] === 'test-runtime-composer'
    }
    return false
  })

  const traceId = spanComposerServer.traceId

  const spanComposerClient = spans.find(span => {
    if (span.kind === SpanKind.CLIENT) {
      return span.resource._attributes['service.name'] === 'test-runtime-composer' &&
        span.attributes['url.full'] === 'http://fastify.plt.local/fastify/node' &&
        span.traceId === traceId
    }
    return false
  })

  const spanFastifyServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return span.resource._attributes['service.name'] === 'test-runtime-fastify' &&
      span.traceId === traceId
    }
    return false
  })

  const spanFastifyClient = spans.find(span => {
    if (span.kind === SpanKind.CLIENT) {
      return span.resource._attributes['service.name'] === 'test-runtime-fastify' &&
        span.attributes['url.full'] === 'http://node.plt.local/' &&
        span.traceId === traceId
    }
    return false
  })

  const spanNodeServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return span.resource._attributes['service.name'] === 'test-runtime-node' &&
      span.traceId === traceId
    }
    return false
  })

  // check the spans chain
  equal(spanComposerClient.traceId, traceId)
  equal(spanComposerClient.parentId, spanComposerServer.id)

  equal(spanFastifyServer.traceId, traceId)
  equal(spanFastifyServer.parentId, spanComposerClient.id)

  equal(spanFastifyClient.traceId, traceId)
  equal(spanFastifyClient.parentId, spanFastifyServer.id)

  equal(spanNodeServer.traceId, traceId)
  equal(spanNodeServer.parentId, spanFastifyClient.id)
})

test('configure telemetry correctly with a composer + next', async t => {
  // composer -> next -> fastify
  //                  -> node
  //
  // We need to be in production mode to be in the same runtime
  const { root, config } = await basicHelper.prepareRuntime(t,
    'composer-next-node-fastify',
    true,
    'platformatic.json'
  )

  // build next
  const cliPath = join(__dirname, '../../cli', 'cli.js')
  const { execa } = await import('execa')
  await execa('node', [cliPath, 'build'], {
    cwd: root
  })

  const { url } = await basicHelper.startRuntime(t, root, config, false)

  const spansPath = join(root, 'spans.log')

  const { statusCode } = await request(`${url}/next`, {
    method: 'GET',
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
      return span.resource._attributes['service.name'] === 'test-runtime-composer'
    }
    return false
  })

  const spanComposerClient = spans.find(span => {
    if (span.kind === SpanKind.CLIENT) {
      return span.resource._attributes['service.name'] === 'test-runtime-composer' &&
        span.attributes['url.full'] === 'http://next.plt.local/next' &&
        span.traceId === traceId
    }
    return false
  })

  // Next also produces some "type 0" internal spans, that are not relevant for this test
  // so we start from the last ones (node and fastify server span) and go backward
  // back to the composer one
  const spanNodeServer = spans.find(span => {
    if (span.kind === SpanKind.SERVER) {
      return span.resource._attributes['service.name'] === 'test-runtime-node' &&
      span.traceId === traceId
    }
    return false
  })
  const spanNextClientNode = findParentSpan(spans, spanNodeServer, SpanKind.CLIENT, 'GET http://node.plt.local/')
  const spanNextServer = findSpanWithParentWithId(spans, spanNextClientNode, spanComposerClient.id)
  equal(spanNextClientNode.traceId, traceId)
  equal(spanNextServer.traceId, traceId)

  // check the spans chain back from next to composer call
  equal(spanNextServer.parentId, spanComposerClient.id)
  equal(spanComposerClient.parentId, spanComposerServer.id)
  equal(spanComposerClient.traceId, traceId)
})
