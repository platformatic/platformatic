'use strict'

const { test } = require('node:test')
const { deepEqual, equal, match, ok } = require('node:assert')
const fastify = require('fastify')
const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const { clear, isSQLite, connInfo, expectedTelemetryPrefix } = require('./helper')
const { telemetry } = require('@platformatic/telemetry')
const { plugin: mapper } = require('..')

const fakeLogger = {
  trace: () => {},
  error: () => {},
  warn: () => {},
}

async function setupDBAppWithTelemetry (telemetryOpts, onDatabaseLoad, plugins, teardown) {
  const { connectionString } = connInfo
  const app = fastify()
  await app.register(telemetry, telemetryOpts)
  await app.register(mapper, {
    connectionString,
    log: fakeLogger,
    onDatabaseLoad,
  })

  for (const plugin of plugins) {
    await app.register(plugin)
  }
  app.ready()
  teardown(async () => {
    await app.close()
    const { exporters } = app.openTelemetry
    exporters.forEach((exporter) => {
      if (exporter.constructor.name === 'InMemorySpanExporter') {
        exporter.reset()
      }
    })
  })
  return app
}

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL
      );`)
  }
}

async function onDatabaseLoad (db, sql) {
  await clear(db, sql)
  await createBasicPages(db, sql)
}

test('should trace a request getting DB from the request and running the query manually', async () => {
  const plugin = async (app) => {
    app.get('/custom-pages', async (request, _reply) => {
      try {
        const db = request.getDB()
        const { sql } = app.platformatic
        return db.query(sql`SELECT id, title FROM pages;`)
      } catch (err) {
        console.error(err)
      }
    })
  }
  const app = await setupDBAppWithTelemetry(
    {
      serviceName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory',
      },
    },
    onDatabaseLoad,
    [plugin],
    test.after
  )
  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  exporter.reset() //  we reset to avoid the queies to load all the metadata

  const res = await app.inject({
    method: 'GET',
    url: '/custom-pages',
  })
  equal(res.statusCode, 200, '/custom-pages status code')

  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 2)

  let dbTraceId, dbParentSpanId
  {
    // DB query span
    const span = finishedSpans[0]
    equal(span.kind, SpanKind.CLIENT) // this is the db client span
    const expectedName = `${expectedTelemetryPrefix}.query:`
    const expectedNameRE = new RegExp(`^${expectedName}`)
    match(span.name, expectedNameRE)
    match(
      span.attributes['db.statement'],
      /^SELECT id, title/
    )
    const resource = span.resource
    deepEqual(resource.attributes['service.name'], 'test-service')
    deepEqual(resource.attributes['service.version'], '1.0.0')
    dbTraceId = span.spanContext().traceId
    dbParentSpanId = span.parentSpanId
  }
  {
    // HTTP request span
    const span = finishedSpans[1]
    equal(span.kind, SpanKind.SERVER)
    equal(span.name, 'GET /custom-pages')
    equal(span.status.code, SpanStatusCode.OK)
    equal(span.attributes['http.request.method'], 'GET')
    equal(span.attributes['url.path'], '/custom-pages')
    equal(span.attributes['http.response.status_code'], 200)
    equal(span.attributes['url.scheme'], 'http')
    const resource = span.resource
    deepEqual(resource.attributes['service.name'], 'test-service')
    deepEqual(resource.attributes['service.version'], '1.0.0')

    const spanId = span._spanContext.spanId
    const traceId = span._spanContext.traceId
    const parentSpanId = span.parentSpanId

    // Check that the traceId is the same and the http span is the parent of the db span
    equal(traceId, dbTraceId)
    equal(dbParentSpanId, spanId) // the db span is the child of the http span
    ok(!parentSpanId) // the http span has no parent
  }
})
