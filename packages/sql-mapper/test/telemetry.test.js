import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { telemetry } from '@platformatic/telemetry'
import fastify from 'fastify'
import { deepEqual, equal, match, ok } from 'node:assert'
import { test } from 'node:test'
import { plugin as mapper } from '../index.js'
import { clear, connInfo, expectedPort, expectedTelemetryPrefix, isMysql, isMysql8, isPg, isSQLite } from './helper.js'

const fakeLogger = {
  trace: () => {},
  error: () => {},
  warn: () => {}
}

async function setupDBAppWithTelemetry (telemetryOpts, onDatabaseLoad, plugins, teardown) {
  const { connectionString } = connInfo
  const app = fastify()
  await app.register(telemetry, telemetryOpts)
  await app.register(mapper, {
    connectionString,
    log: fakeLogger,
    onDatabaseLoad
  })

  for (const plugin of plugins) {
    await app.register(plugin)
  }
  app.ready()
  teardown(async () => {
    await app.close()
    const { exporters } = app.openTelemetry
    exporters.forEach(exporter => {
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

async function onDatabaseLoadWithData (db, sql) {
  await clear(db, sql)
  await createBasicPages(db, sql)
  await db.query(sql`INSERT INTO pages (title) VALUES ('foo')`)
  await db.query(sql`INSERT INTO pages (title) VALUES ('bar')`)
}

test('should trace a request getting DB from the request and running the query manually', async () => {
  const plugin = async app => {
    app.get('/custom-pages', async (request, _reply) => {
      const db = request.getDB()
      const sql = db.sql
      return db.query(sql`SELECT id, title FROM pages;`)
    })
  }
  const app = await setupDBAppWithTelemetry(
    {
      applicationName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
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
    url: '/custom-pages'
  })
  equal(res.statusCode, 200, '/custom-pages status code')

  const finishedSpans = exporter.getFinishedSpans()
  // FastifyOtelInstrumentation creates additional spans (onRequest, handler, request)
  // so we expect at least 2 spans (1 CLIENT for DB, 1 SERVER for HTTP)
  ok(finishedSpans.length >= 2, `Expected at least 2 spans, got ${finishedSpans.length}`)

  let dbTraceId, dbParentSpanId
  {
    // DB query span - find the CLIENT span
    const span = finishedSpans.find(s => s.kind === SpanKind.CLIENT)
    ok(span, 'Should have a CLIENT span for DB query')
    equal(span.kind, SpanKind.CLIENT) // this is the db client span
    const expectedName = `${expectedTelemetryPrefix}.query:`
    const expectedNameRE = new RegExp(`^${expectedName}`)
    match(span.name, expectedNameRE)
    match(span.attributes['db.statement'], /^SELECT id, title/)

    if (isSQLite) {
      equal(span.attributes['db.system'], 'sqlite')
      equal(span.attributes['db.name'], ':memory:')
    } else if (isPg) {
      equal(span.attributes['db.system'], 'postgresql')
      equal(span.attributes['db.name'], 'postgres')
      equal(span.attributes['db.user'], 'postgres')
      equal(span.attributes['net.peer.name'], '127.0.0.1')
      equal(span.attributes['net.peer.port'], expectedPort)
    } else if (isMysql || isMysql8) {
      equal(span.attributes['db.system'], 'mysql')
      equal(span.attributes['db.name'], 'graph')
      equal(span.attributes['db.user'], 'root')
      equal(span.attributes['net.peer.name'], '127.0.0.1')
      equal(span.attributes['net.peer.port'], expectedPort)
    }

    const resource = span.resource
    deepEqual(resource.attributes['service.name'], 'test-service')
    deepEqual(resource.attributes['service.version'], '1.0.0')
    dbTraceId = span.spanContext().traceId
    dbParentSpanId = span.parentSpanContext?.spanId
  }
  {
    // HTTP request span - find the SERVER span
    const httpServerSpan = finishedSpans.find(s => s.kind === SpanKind.SERVER)
    ok(httpServerSpan, 'Should have a SERVER span for HTTP request')
    equal(httpServerSpan.kind, SpanKind.SERVER)
    equal(httpServerSpan.name, 'GET /custom-pages')
    equal(httpServerSpan.status.code, SpanStatusCode.OK)
    equal(httpServerSpan.attributes['http.request.method'], 'GET')
    // Note: LightMyRequestInstrumentation doesn't set http.route
    equal(httpServerSpan.attributes['url.path'], '/custom-pages')
    equal(httpServerSpan.attributes['http.response.status_code'], 200)
    equal(httpServerSpan.attributes['url.scheme'], 'http')
    const resource = httpServerSpan.resource
    deepEqual(resource.attributes['service.name'], 'test-service')
    deepEqual(resource.attributes['service.version'], '1.0.0')

    const httpServerSpanId = httpServerSpan._spanContext.spanId
    const traceId = httpServerSpan._spanContext.traceId
    const parentSpanId = httpServerSpan.parentSpanContext?.spanId

    // Check that the traceId is the same
    equal(traceId, dbTraceId)
    ok(!parentSpanId) // the http server span has no parent

    // The DB span should be a child of either:
    // 1. The SERVER span directly, OR
    // 2. An INTERNAL span that is part of the HTTP request processing
    // FastifyOtelInstrumentation creates INTERNAL spans for route handlers,
    // so the DB span will be a child of the handler INTERNAL span
    const httpRelatedSpanIds = new Set()
    httpRelatedSpanIds.add(httpServerSpanId) // The SERVER span

    // Find all INTERNAL spans that are descendants of the SERVER span
    // We need to iterate until no new spans are added, to build the full tree
    const internalSpans = finishedSpans.filter(s => s.kind === SpanKind.INTERNAL)
    let added = true
    while (added) {
      added = false
      for (const internalSpan of internalSpans) {
        const internalSpanId = internalSpan._spanContext.spanId
        const internalParentSpanId = internalSpan.parentSpanContext?.spanId
        // If this INTERNAL span is a child of a valid span and not already in the set
        if (internalParentSpanId && httpRelatedSpanIds.has(internalParentSpanId) && !httpRelatedSpanIds.has(internalSpanId)) {
          httpRelatedSpanIds.add(internalSpanId)
          added = true
        }
      }
    }

    // Verify the DB span's parent is one of the HTTP-related spans
    ok(
      httpRelatedSpanIds.has(dbParentSpanId),
      `DB span parent ${dbParentSpanId} should be one of the HTTP-related spans`
    )
  }
})

test('should trace entity operations within a transaction with connectionInfo', async () => {
  const plugin = async app => {
    app.post('/pages-in-transaction', async (request, reply) => {
      const { entities } = app.platformatic
      const { title } = request.body
      const ctx = request.platformaticContext

      // Use transaction with entity operations
      const result = await app.platformatic.db.tx(async tx => {
        // Save operation within transaction
        const newPage = await entities.page.save({
          input: { title },
          fields: ['id', 'title'],
          tx,
          ctx
        })

        // Find operation within transaction
        const allPages = await entities.page.find({
          fields: ['id', 'title'],
          tx,
          ctx
        })

        return { newPage, allPages }
      })

      return result
    })
  }

  const app = await setupDBAppWithTelemetry(
    {
      applicationName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    onDatabaseLoadWithData,
    [plugin],
    test.after
  )

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  exporter.reset() // Reset to avoid the queries to load all the metadata

  const res = await app.inject({
    method: 'POST',
    url: '/pages-in-transaction',
    payload: { title: 'new page in transaction' },
    headers: { 'content-type': 'application/json' }
  })

  equal(res.statusCode, 200, '/pages-in-transaction status code')
  const responseData = JSON.parse(res.payload)
  equal(responseData.newPage.title, 'new page in transaction')
  equal(responseData.allPages.length, 3)

  const finishedSpans = exporter.getFinishedSpans()

  // Should have spans for:
  // 1. INSERT query (save)
  // 2. SELECT query (find)
  // 3. HTTP request
  ok(finishedSpans.length >= 3, `Expected at least 3 spans, got ${finishedSpans.length}`)

  const dbTraceIds = []
  const dbParentSpanIds = []

  // Find all DB query spans
  const dbSpans = finishedSpans.filter(span => span.kind === SpanKind.CLIENT)
  ok(dbSpans.length >= 2, `Expected at least 2 DB spans, got ${dbSpans.length}`)

  for (const span of dbSpans) {
    equal(span.kind, SpanKind.CLIENT, 'DB span should be CLIENT kind')
    const expectedName = `${expectedTelemetryPrefix}.query:`
    const expectedNameRE = new RegExp(`^${expectedName}`)
    match(span.name, expectedNameRE, 'DB span name should match prefix')

    // Verify connectionInfo was properly set
    ok(span.attributes['db.statement'], 'Should have db.statement attribute')

    if (isSQLite) {
      equal(span.attributes['db.system'], 'sqlite')
      equal(span.attributes['db.name'], ':memory:')
    } else if (isPg) {
      equal(span.attributes['db.system'], 'postgresql')
      equal(span.attributes['db.name'], 'postgres')
      equal(span.attributes['db.user'], 'postgres')
      equal(span.attributes['net.peer.name'], '127.0.0.1')
      equal(span.attributes['net.peer.port'], expectedPort)
    } else if (isMysql || isMysql8) {
      equal(span.attributes['db.system'], 'mysql')
      equal(span.attributes['db.name'], 'graph')
      equal(span.attributes['db.user'], 'root')
      equal(span.attributes['net.peer.name'], '127.0.0.1')
      equal(span.attributes['net.peer.port'], expectedPort)
    }

    const resource = span.resource
    deepEqual(resource.attributes['service.name'], 'test-service')
    deepEqual(resource.attributes['service.version'], '1.0.0')

    dbTraceIds.push(span.spanContext().traceId)
    dbParentSpanIds.push(span.parentSpanContext?.spanId)
  }

  // Find HTTP request span
  const httpServerSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)
  ok(httpServerSpan, 'Should have HTTP request span')
  equal(httpServerSpan.name, 'POST /pages-in-transaction')
  equal(httpServerSpan.status.code, SpanStatusCode.OK)
  equal(httpServerSpan.attributes['http.request.method'], 'POST')
  // Note: LightMyRequestInstrumentation doesn't set http.route
  equal(httpServerSpan.attributes['url.path'], '/pages-in-transaction')
  equal(httpServerSpan.attributes['http.response.status_code'], 200)

  const httpServerSpanId = httpServerSpan._spanContext.spanId
  const httpTraceId = httpServerSpan._spanContext.traceId

  // Verify all DB spans are part of the same trace as the HTTP request
  for (const dbTraceId of dbTraceIds) {
    equal(dbTraceId, httpTraceId, 'DB spans should have same traceId as HTTP span')
  }

  // Build set of all HTTP-related span IDs (SERVER + INTERNAL descendants)
  const httpRelatedSpanIds = new Set()
  httpRelatedSpanIds.add(httpServerSpanId)

  const internalSpans = finishedSpans.filter(span => span.kind === SpanKind.INTERNAL)
  let added = true
  while (added) {
    added = false
    for (const internalSpan of internalSpans) {
      const internalSpanId = internalSpan._spanContext.spanId
      const internalParentSpanId = internalSpan.parentSpanContext?.spanId
      if (internalParentSpanId && httpRelatedSpanIds.has(internalParentSpanId) && !httpRelatedSpanIds.has(internalSpanId)) {
        httpRelatedSpanIds.add(internalSpanId)
        added = true
      }
    }
  }

  // Verify all DB spans are children of HTTP-related spans
  for (const dbParentSpanId of dbParentSpanIds) {
    ok(
      httpRelatedSpanIds.has(dbParentSpanId),
      `DB span parent ${dbParentSpanId} should be one of the HTTP-related spans`
    )
  }
})

test('should handle transaction rollback with telemetry', async () => {
  const plugin = async app => {
    app.post('/pages-rollback', async (request, _reply) => {
      const { entities } = app.platformatic
      const { title } = request.body
      const ctx = request.platformaticContext

      try {
        await app.platformatic.db.tx(async tx => {
          await entities.page.save({
            input: { title },
            fields: ['id', 'title'],
            tx,
            ctx
          })

          // Force rollback
          throw new Error('intentional rollback')
        })
      } catch (err) {
        // Verify it rolled back
        const pages = await entities.page.find({
          fields: ['id', 'title'],
          where: { title: { eq: title } },
          ctx
        })

        return { rolledBack: pages.length === 0 }
      }
    })
  }

  const app = await setupDBAppWithTelemetry(
    {
      applicationName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    onDatabaseLoadWithData,
    [plugin],
    test.after
  )

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  exporter.reset()

  const res = await app.inject({
    method: 'POST',
    url: '/pages-rollback',
    payload: { title: 'should be rolled back' },
    headers: { 'content-type': 'application/json' }
  })

  equal(res.statusCode, 200)
  const responseData = JSON.parse(res.payload)
  equal(responseData.rolledBack, true, 'Transaction should have rolled back')

  const finishedSpans = exporter.getFinishedSpans()
  ok(finishedSpans.length >= 2, 'Should have at least INSERT and SELECT spans')

  // Verify all spans have proper connection info despite transaction rollback
  const dbSpans = finishedSpans.filter(span => span.kind === SpanKind.CLIENT)
  for (const span of dbSpans) {
    ok(span.attributes['db.statement'], 'Should have db.statement even after rollback')
    ok(span.attributes['db.system'], 'Should have db.system even after rollback')
  }
})

test('should trace entity count operations within transaction', async () => {
  const plugin = async app => {
    app.get('/pages-count-tx', async (request, _reply) => {
      const { entities } = app.platformatic
      const ctx = request.platformaticContext

      const result = await app.platformatic.db.tx(async tx => {
        const count = await entities.page.count({
          tx,
          ctx
        })

        return { count }
      })

      return result
    })
  }

  const app = await setupDBAppWithTelemetry(
    {
      applicationName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    onDatabaseLoadWithData,
    [plugin],
    test.after
  )

  const { exporters } = app.openTelemetry
  const exporter = exporters[0]
  exporter.reset()

  const res = await app.inject({
    method: 'GET',
    url: '/pages-count-tx'
  })

  equal(res.statusCode, 200)
  const responseData = JSON.parse(res.payload)
  equal(responseData.count, 2, 'Should count existing pages')

  const finishedSpans = exporter.getFinishedSpans()
  const dbSpans = finishedSpans.filter(span => span.kind === SpanKind.CLIENT)
  ok(dbSpans.length >= 1, 'Should have at least one DB span for count')

  // Verify the count query has proper connection info
  const countSpan = dbSpans.find(span =>
    span.attributes['db.statement'] &&
    span.attributes['db.statement'].includes('COUNT')
  )
  ok(countSpan, 'Should have a COUNT query span')
  ok(countSpan.attributes['db.system'], 'COUNT span should have db.system')
})
