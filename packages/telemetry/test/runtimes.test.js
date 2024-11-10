'use strict'

const { equal, deepEqual } = require('node:assert')
const { resolve, join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { parseNDJson } = require('./helper.js')
const { setTimeout: sleep } = require('node:timers/promises')
const { SpanKind } = require('@opentelemetry/api')

process.setMaxListeners(100)

let createRuntime

const getSpans = async (spanPaths) => {
  const spans = await parseNDJson(spanPaths)
  return spans
}

test.before(async () => {
  const { createRuntime: create, setFixturesDir } = await import('../../basic/test/helper.js')
  const fixturesDir = resolve(__dirname, './fixtures')
  createRuntime = create
  setFixturesDir(fixturesDir)
})

test('configure telemtry correctly with a node app', async t => {
  const app = await createRuntime(t,
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

test('configure telemtry correctly with a express app', async t => {
  const app = await createRuntime(t,
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
  const app = await createRuntime(t,
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

test('configure telemetry correctly with a composer + node + fastify', { only: true }, async t => {
  const app = await createRuntime(t,
    'composer-next-node-fastify',
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

// test('configure telemetry correctly with a composer + next', async t => {
//   const app = await createRuntime(t,
//     'composer-next-node-fastify',
//     false,
//     true,
//     'platformatic.json'
//   )
//   const { url, root } = app
//   const spansPath = join(root, 'spans.log')
//
//   // Test request to add http metrics
//   const { statusCode } = await request(`${url}/next`, {
//     method: 'GET',
//   })
//   equal(statusCode, 200)
//   await sleep(1000)
//   const spans = await getSpans(spansPath)
//
//   // We can have spurious span (like the one from the composr to services) so we need to filter
//   // the one for the actual call
//   const spanComposerServer = spans.find(span => {
//     if (span.kind === SpanKind.SERVER) {
//       return span.resource._attributes['service.name'] === 'test-runtime-composer'
//     }
//     return false
//   })
//
//   const traceId = spanComposerServer.traceId
//
//   const spansInTrace = spans.filter(span => span.traceId === traceId)
//
//   // console.log("@@@@@@@@@@@@@@@@@", JSON.stringify(spans, null, 2))
//
//   // console.log("@@@@@@@@@@@@@@@@@", JSON.stringify(spansInTrace, null, 2))
//
//   const spanComposerClient = spans.find(span => {
//     if (span.kind === SpanKind.CLIENT) {
//       return span.resource._attributes['service.name'] === 'test-runtime-composer' &&
//         span.attributes['url.full'] === 'http://next.plt.local/next' &&
//         span.traceId === traceId
//     }
//     return false
//   })
//
//   const spanNextServer = spans.find(span => {
//     if (span.kind === SpanKind.SERVER) {
//       return span.resource._attributes['service.name'] === 'test-runtime-next' &&
//       span.traceId === traceId
//     }
//     return false
//   })
//
//   const spanNextClientNode = spans.find(span => {
//     if (span.kind === SpanKind.CLIENT) {
//       return span.resource._attributes['service.name'] === 'test-runtime-next' &&
//         span.attributes['http.url'] === 'http://node.plt.local/' &&
//         span.traceId === traceId
//     }
//     return false
//   })
//
//   const spanNextClientFastify = spans.find(span => {
//     if (span.kind === SpanKind.CLIENT) {
//       return span.resource._attributes['service.name'] === 'test-runtime-next' &&
//         span.attributes['http.url'] === 'http://fastify.plt.local/' &&
//         span.traceId === traceId
//     }
//     return false
//   })
//
//   const spanNodeServer = spans.find(span => {
//     if (span.kind === SpanKind.SERVER) {
//       return span.resource._attributes['service.name'] === 'test-runtime-node' &&
//       span.traceId === traceId
//     }
//     return false
//   })
//
//   const spanFastifyServer = spans.find(span => {
//     if (span.kind === SpanKind.SERVER) {
//       return span.resource._attributes['service.name'] === 'test-runtime-fastify' &&
//       span.traceId === traceId
//     }
//     return false
//   })
//
//   // console.log(spanComposerServer)
//   // console.log(spanComposerClient)
//   console.log(spanNextServer)
//   console.log(spanNextClientNode)
//   // console.log(spanNodeServer)
//   // console.log(spanNextClientFastify)
//   // console.log(spanFastifyServer)
//
//   ok(spanFastifyServer)
// })
