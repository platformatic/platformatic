import { create } from '@platformatic/db'
import { safeRemove } from '@platformatic/foundation'
import { telemetry } from '@platformatic/telemetry'
import Fastify from 'fastify'
import { equal } from 'node:assert/strict'
import { cp, mkdtemp, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import client from '../fastify-plugin.js'
import './helper.js'

const getSpansPerType = (spans, type = 'http') => {
  let attibuteToLookFor
  if (type === 'graphql') {
    attibuteToLookFor = 'graphql.document'
  } else if (type === 'db') {
    attibuteToLookFor = 'db.system'
  } else if (type === 'http') {
    attibuteToLookFor = 'url.path'
  } else {
    throw new Error(`Type ${type} not supported`)
  }
  return spans.filter(span => span.attributes[attibuteToLookFor])
}

test('telemetry correctly propagates from an application client to a server for an OpenAPI endpoint', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'telemetry')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  // Server app
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
  })

  await targetApp.start()
  const targetAppUrl = targetApp.url

  // Client app
  const app = Fastify()
  app.register(telemetry, {
    applicationName: 'test-client',
    exporter: {
      type: 'memory'
    }
  })

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'movies',
    fullRequest: false,
    fullResponse: false
  })

  app.post('/', async req => {
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
  equal(finishedSpans.length, 2)
  const clientSpan = finishedSpans[0]
  const postSpan = finishedSpans[1]
  // The parent of the client span is the post span
  // and both have the same traceId
  equal(clientSpan.parentSpanContext.spanId, postSpan.spanContext().spanId)
  equal(clientSpan.spanContext().traceId, postSpan.spanContext().traceId)
  equal(clientSpan.name, `POST ${targetAppUrl}/movies/`)
  equal(clientSpan.attributes['url.full'], `${targetAppUrl}/movies/`)
  equal(clientSpan.attributes['http.response.status_code'], 200)
  const clientTraceId = clientSpan.spanContext().traceId
  const clientSpanId = clientSpan.spanContext().spanId

  // Target app, we check that propagation works
  const httpSpans = getSpansPerType(targetApp.getApplication().openTelemetry.exporters[0].getFinishedSpans(), 'http')
  equal(httpSpans.length, 2)
  // The first span is the client call to `/documentation/json`, the second is the server call to `/movies/
  const serverSpan = httpSpans[1]
  equal(serverSpan.name, 'POST /movies/')
  const serverTraceId = serverSpan.spanContext().traceId
  const serverParentSpanId = serverSpan.parentSpanContext.spanId
  // The propagation works
  equal(serverParentSpanId, clientSpanId)
  equal(serverTraceId, clientTraceId)
})

test('telemetry correctly propagates from a generic client through an application client and then to another application, propagating the traceId', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'telemetry')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  // Server app
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
  })
  await targetApp.start()
  const targetAppUrl = targetApp.url

  // Client app
  const app = Fastify()
  app.register(telemetry, {
    applicationName: 'test-client',
    exporter: {
      type: 'memory'
    }
  })

  await app.register(client, {
    type: 'openapi',
    url: `${targetApp.url}/documentation/json`,
    name: 'movies',
    fullRequest: false,
    fullResponse: false
  })

  app.post('/', async req => {
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
  equal(finishedSpans.length, 2)
  const clientSpan = finishedSpans[0]
  const postSpan = finishedSpans[1]
  // The parent of the client span is the post span
  // and both have the same traceId
  equal(clientSpan.parentSpanContext.spanId, postSpan.spanContext().spanId)
  equal(clientSpan.spanContext().traceId, postSpan.spanContext().traceId)
  equal(clientSpan.name, `POST ${targetAppUrl}/movies/`)
  equal(clientSpan.attributes['url.full'], `${targetAppUrl}/movies/`)
  equal(clientSpan.attributes['http.response.status_code'], 200)
  const clientTraceId = clientSpan.spanContext().traceId
  const clientSpanId = clientSpan.spanContext().spanId
  equal(clientTraceId, traceId)

  // Target app
  // We get the http spans (we also have the DB ones)
  const httpSpans = getSpansPerType(targetApp.getApplication().openTelemetry.exporters[0].getFinishedSpans(), 'http')
  equal(httpSpans.length, 2)
  // The first span is the client call to `/documentation/json`, the second is the server call to `/movies/
  const serverSpan = httpSpans[1]
  equal(serverSpan.name, 'POST /movies/')
  const serverTraceId = serverSpan.spanContext().traceId
  const serverParentSpanId = serverSpan.parentSpanContext.spanId
  // The propagation works. Note that the `parentSpan` is changed, but the traceId is the same
  equal(serverParentSpanId, clientSpanId)
  equal(serverTraceId, traceId)
})

test('telemetry correctly propagates from an application client to a server for a GraphQL endpoint', async t => {
  const fixtureDirPath = join(import.meta.dirname, 'fixtures', 'telemetry')
  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-client-'))
  await cp(fixtureDirPath, tmpDir, { recursive: true })

  try {
    await unlink(join(fixtureDirPath, 'db.sqlite'))
  } catch {
    // noop
  }
  // Server app
  const targetApp = await create(join(tmpDir, 'platformatic.db.json'))
  t.after(async () => {
    await targetApp.close()
    await safeRemove(tmpDir)
  })
  await targetApp.start()
  const targetAppUrl = targetApp.url

  // Client app
  const app = Fastify()
  app.register(telemetry, {
    applicationName: 'test-client',
    exporter: {
      type: 'memory'
    }
  })

  await app.register(client, {
    type: 'graphql',
    url: `${targetApp.url}/graphql`
  })

  app.post('/', async req => {
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
  equal(finishedSpans.length, 2)
  const clientSpan = finishedSpans[0]
  const postSpan = finishedSpans[1]
  // The parent of the client span is the post span
  // and both have the same traceId
  equal(clientSpan.parentSpanContext.spanId, postSpan.spanContext().spanId)
  equal(clientSpan.spanContext().traceId, postSpan.spanContext().traceId)
  equal(clientSpan.name, `POST ${targetAppUrl}/graphql`)
  equal(clientSpan.attributes['url.full'], `${targetAppUrl}/graphql`)
  equal(clientSpan.attributes['http.response.status_code'], 200)
  const clientTraceId = clientSpan.spanContext().traceId
  const clientSpanId = clientSpan.spanContext().spanId

  // Target app, we check that propagation works
  // We get the http spans (we also have the DB ones)
  const httpSpans = getSpansPerType(targetApp.getApplication().openTelemetry.exporters[0].getFinishedSpans(), 'http')
  equal(httpSpans.length, 1)
  const serverSpan = httpSpans[0]
  equal(serverSpan.name, 'POST /graphql')
  const serverTraceId = serverSpan.spanContext().traceId
  const serverParentSpanId = serverSpan.parentSpanContext.spanId
  // The propagation works
  equal(serverParentSpanId, clientSpanId)
  equal(serverTraceId, clientTraceId)

  const graphqlSpan = getSpansPerType(
    targetApp.getApplication().openTelemetry.exporters[0].getFinishedSpans(),
    'graphql'
  )[0]
  equal(graphqlSpan.name, 'mutation saveMovie')
  equal(graphqlSpan.spanContext().traceId, clientTraceId)
  equal(graphqlSpan.parentSpanContext.spanId, serverSpan.spanContext().spanId)
})
