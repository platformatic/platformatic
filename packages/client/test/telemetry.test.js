'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { mkdtemp, cp, unlink, rm } = require('node:fs/promises')
const Fastify = require('fastify')
const { telemetry } = require('@platformatic/telemetry')
const { buildServer } = require('../../db')
const client = require('..')
require('./helper')

test('telemetry correctly propagates from a service client to a server for an OpenAPI endpoint', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'telemetry')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  // Server app
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()
  const targetAppUrl = targetApp.url

  // Client app
  const app = Fastify()
  app.register(telemetry, {
    serviceName: 'test-client',
    exporter: {
      type: 'memory'
    }
  })

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'movies'
  })

  app.post('/', async (req) => {
    const movie = await req.movies.createMovie({
      title: 'The Matrix'
    })

    return movie
  })

  await app.inject({
    method: 'POST',
    url: '/'
  })

  const { exporters } = app.openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()
  // The first span is the client span, the second (because ended after the first) is the span for the POST that triggers the client
  assert.equal(finishedSpans.length, 2)
  const clientSpan = finishedSpans[0]
  const postSpan = finishedSpans[1]
  // The parent of the client span is the post span
  // and both have the same traceId
  assert.equal(clientSpan.parentSpanId, postSpan.spanContext().spanId)
  assert.equal(clientSpan.spanContext().traceId, postSpan.spanContext().traceId)
  assert.equal(clientSpan.name, `POST ${targetAppUrl}/movies/`)
  assert.equal(clientSpan.attributes['url.full'], `${targetAppUrl}/movies/`)
  assert.equal(clientSpan.attributes['http.response.status_code'], 200)
  const clientTraceId = clientSpan.spanContext().traceId
  const clientSpanId = clientSpan.spanContext().spanId

  // Target app, we check that propagation works
  assert.equal(targetApp.openTelemetry.exporters[0].getFinishedSpans().length, 2)
  // The first span is the client call to `/documentation/json`, the second is the server call to `/movies/
  const serverSpan = targetApp.openTelemetry.exporters[0].getFinishedSpans()[1]
  assert.equal(serverSpan.name, 'POST /movies/')
  const serverTraceId = serverSpan.spanContext().traceId
  const serverParentSpanId = serverSpan.parentSpanId
  // The propagation works
  assert.equal(serverParentSpanId, clientSpanId)
  assert.equal(serverTraceId, clientTraceId)
})

test('telemetry correctly propagates from a generic client through a service client and then to another service, propagating the traceId', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'telemetry')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  // Server app
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()
  const targetAppUrl = targetApp.url

  // Client app
  const app = Fastify()
  app.register(telemetry, {
    serviceName: 'test-client',
    exporter: {
      type: 'memory'
    }
  })

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'movies'
  })

  app.post('/', async (req) => {
    const movie = await req.movies.createMovie({
      title: 'The Matrix'
    })
    return movie
  })

  // This is the traceId we want to propagate
  const traceId = '5e994e8fb53b27c91dcd2fec22771d15'
  const spanId = '166f3ab30f21800b'
  const traceparent = `00-${traceId}-${spanId}-01`
  await app.inject({
    method: 'POST',
    url: '/',
    headers: {
      traceparent
    }
  })

  const { exporters } = app.openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()

  // The first span is the client span, the second (because ended after the first) is the span for the POST that triggers the client
  assert.equal(finishedSpans.length, 2)
  const clientSpan = finishedSpans[0]
  const postSpan = finishedSpans[1]
  // The parent of the client span is the post span
  // and both have the same traceId
  assert.equal(clientSpan.parentSpanId, postSpan.spanContext().spanId)
  assert.equal(clientSpan.spanContext().traceId, postSpan.spanContext().traceId)
  assert.equal(clientSpan.name, `POST ${targetAppUrl}/movies/`)
  assert.equal(clientSpan.attributes['url.full'], `${targetAppUrl}/movies/`)
  assert.equal(clientSpan.attributes['http.response.status_code'], 200)
  const clientTraceId = clientSpan.spanContext().traceId
  const clientSpanId = clientSpan.spanContext().spanId
  assert.equal(clientTraceId, traceId)

  // Target app
  assert.equal(targetApp.openTelemetry.exporters[0].getFinishedSpans().length, 2)
  // The first span is the client call to `/documentation/json`, the second is the server call to `/movies/
  const serverSpan = targetApp.openTelemetry.exporters[0].getFinishedSpans()[1]
  assert.equal(serverSpan.name, 'POST /movies/')
  const serverTraceId = serverSpan.spanContext().traceId
  const serverParentSpanId = serverSpan.parentSpanId
  // The propagation works. Note that the `parentSpan` is changed, but the traceId is the same
  assert.equal(serverParentSpanId, clientSpanId)
  assert.equal(serverTraceId, traceId)
})

test('telemetry correctly propagates from a service client to a server for an GraphQL endpoint', async (t) => {
  const fixtureDirPath = join(__dirname, 'fixtures', 'telemetry')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  // Server app
  const targetApp = await buildServer(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await rm(tmpDir, { recursive: true })
  })
  await targetApp.start()
  const targetAppUrl = targetApp.url

  // Client app
  const app = Fastify()
  app.register(telemetry, {
    serviceName: 'test-client',
    exporter: {
      type: 'memory'
    }
  })

  await app.register(client, {
    type: 'graphql',
    url: `${targetApp.url}/graphql`
  })

  app.post('/', async (req) => {
    const movie = await req.client.graphql({
      query: `
        mutation createMovie($title: String!) {
          saveMovie(input: {title: $title}) {
            id
            title
          }
        }
      `,
      variables: {
        title: 'The Matrix'
      }
    })
    return movie
  })

  await app.inject({
    method: 'POST',
    url: '/'
  })

  const { exporters } = app.openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()
  // The first span is the client span, the second (because ended after the first) is the span for the POST that triggers the client
  assert.equal(finishedSpans.length, 2)
  const clientSpan = finishedSpans[0]
  const postSpan = finishedSpans[1]
  // The parent of the client span is the post span
  // and both have the same traceId
  assert.equal(clientSpan.parentSpanId, postSpan.spanContext().spanId)
  assert.equal(clientSpan.spanContext().traceId, postSpan.spanContext().traceId)
  assert.equal(clientSpan.name, `POST ${targetAppUrl}/graphql`)
  assert.equal(clientSpan.attributes['url.full'], `${targetAppUrl}/graphql`)
  assert.equal(clientSpan.attributes['http.response.status_code'], 200)
  const clientTraceId = clientSpan.spanContext().traceId
  const clientSpanId = clientSpan.spanContext().spanId

  // Target app, we check that propagation works
  assert.equal(targetApp.openTelemetry.exporters[0].getFinishedSpans().length, 2)
  const serverSpan = targetApp.openTelemetry.exporters[0].getFinishedSpans()[1]
  assert.equal(serverSpan.name, 'POST /graphql')
  const serverTraceId = serverSpan.spanContext().traceId
  const serverParentSpanId = serverSpan.parentSpanId
  // The propagation works
  assert.equal(serverParentSpanId, clientSpanId)
  assert.equal(serverTraceId, clientTraceId)

  const graphqlSpan = targetApp.openTelemetry.exporters[0].getFinishedSpans()[0]
  assert.equal(graphqlSpan.name, 'mutation saveMovie')
  assert.equal(graphqlSpan.spanContext().traceId, clientTraceId)
  assert.equal(graphqlSpan.parentSpanId, serverSpan.spanContext().spanId)
})
