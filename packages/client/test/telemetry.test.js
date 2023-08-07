'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer } = require('../../db')
const { join } = require('path')
const client = require('..')
const fs = require('fs/promises')
const Fastify = require('fastify')
const { telemetry } = require('@platformatic/telemetry')

test('telemetry correctly propagates from a service client to a server for an OpenAPI endpoint', async ({ teardown, same, rejects, equal, ok }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'telemetry', 'db.sqlite'))
  } catch {
    // noop
  }
  // Server app
  const targetApp = await buildServer(join(__dirname, 'fixtures', 'telemetry', 'platformatic.db.json'))
  teardown(async () => {
    await targetApp.close()
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

  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  // The first span is the client span, the second (because ended after the first) is the span for the POST that triggers the client
  equal(finishedSpans.length, 2)
  const clientSpan = finishedSpans[0]
  const postSpan = finishedSpans[1]
  // The parent of the client span is the post span
  // and both have the same traceId
  equal(clientSpan.parentSpanId, postSpan.spanContext().spanId)
  equal(clientSpan.spanContext().traceId, postSpan.spanContext().traceId)
  equal(clientSpan.name, `POST ${targetAppUrl}/movies/`)
  equal(clientSpan.attributes['url.full'], `${targetAppUrl}/movies/`)
  equal(clientSpan.attributes['http.response.status_code'], 200)
  const clientTraceId = clientSpan.spanContext().traceId
  const clientSpanId = clientSpan.spanContext().spanId

  // Target app, we check that propagation works
  same(targetApp.openTelemetry.exporter.getFinishedSpans().length, 2)
  // The first span is the client call to `/documentation/json`, the second is the server call to `/movies/
  const serverSpan = targetApp.openTelemetry.exporter.getFinishedSpans()[1]
  same(serverSpan.name, 'POST /movies/')
  const serverTraceId = serverSpan.spanContext().traceId
  const serverParentSpanId = serverSpan.parentSpanId
  // The propagation works
  same(serverParentSpanId, clientSpanId)
  same(serverTraceId, clientTraceId)
})

test('telemetry correctly propagates from a generic client through a service client and then to another service, propagating the traceId', async ({ teardown, same, rejects, equal, ok }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'telemetry', 'db.sqlite'))
  } catch {
    // noop
  }
  // Server app
  const targetApp = await buildServer(join(__dirname, 'fixtures', 'telemetry', 'platformatic.db.json'))
  teardown(async () => {
    await targetApp.close()
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

  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()

  // The first span is the client span, the second (because ended after the first) is the span for the POST that triggers the client
  equal(finishedSpans.length, 2)
  const clientSpan = finishedSpans[0]
  const postSpan = finishedSpans[1]
  // The parent of the client span is the post span
  // and both have the same traceId
  equal(clientSpan.parentSpanId, postSpan.spanContext().spanId)
  equal(clientSpan.spanContext().traceId, postSpan.spanContext().traceId)
  equal(clientSpan.name, `POST ${targetAppUrl}/movies/`)
  equal(clientSpan.attributes['url.full'], `${targetAppUrl}/movies/`)
  equal(clientSpan.attributes['http.response.status_code'], 200)
  const clientTraceId = clientSpan.spanContext().traceId
  const clientSpanId = clientSpan.spanContext().spanId
  same(clientTraceId, traceId)

  // Target app
  same(targetApp.openTelemetry.exporter.getFinishedSpans().length, 2)
  // The first span is the client call to `/documentation/json`, the second is the server call to `/movies/
  const serverSpan = targetApp.openTelemetry.exporter.getFinishedSpans()[1]
  same(serverSpan.name, 'POST /movies/')
  const serverTraceId = serverSpan.spanContext().traceId
  const serverParentSpanId = serverSpan.parentSpanId
  // The propagation works. Note that the `parentSpan` is changed, but the traceId is the same
  same(serverParentSpanId, clientSpanId)
  same(serverTraceId, traceId)
})

test('telemetry correctly propagates from a service client to a server for an GraphQL endpoint', async ({ teardown, same, rejects, equal, ok }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'telemetry', 'db.sqlite'))
  } catch {
    // noop
  }
  // Server app
  const targetApp = await buildServer(join(__dirname, 'fixtures', 'telemetry', 'platformatic.db.json'))
  teardown(async () => {
    await targetApp.close()
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

  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  // The first span is the client span, the second (because ended after the first) is the span for the POST that triggers the client
  equal(finishedSpans.length, 2)
  const clientSpan = finishedSpans[0]
  const postSpan = finishedSpans[1]
  // The parent of the client span is the post span
  // and both have the same traceId
  equal(clientSpan.parentSpanId, postSpan.spanContext().spanId)
  equal(clientSpan.spanContext().traceId, postSpan.spanContext().traceId)
  equal(clientSpan.name, `POST ${targetAppUrl}/graphql`)
  equal(clientSpan.attributes['url.full'], `${targetAppUrl}/graphql`)
  equal(clientSpan.attributes['http.response.status_code'], 200)
  const clientTraceId = clientSpan.spanContext().traceId
  const clientSpanId = clientSpan.spanContext().spanId

  // Target app, we check that propagation works
  same(targetApp.openTelemetry.exporter.getFinishedSpans().length, 1)
  const serverSpan = targetApp.openTelemetry.exporter.getFinishedSpans()[0]
  same(serverSpan.name, 'POST /graphql')
  const serverTraceId = serverSpan.spanContext().traceId
  const serverParentSpanId = serverSpan.parentSpanId

  // The propagation works
  same(serverParentSpanId, clientSpanId)
  same(serverTraceId, clientTraceId)
})
