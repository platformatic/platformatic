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
  equal(finishedSpans.length, 2)

  let dbTraceId, dbParentSpanId
  {
    // DB query span
    const span = finishedSpans[0]
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
    // HTTP request span
    const span = finishedSpans[1]
    equal(span.kind, SpanKind.SERVER)
    equal(span.name, 'GET /custom-pages')
    equal(span.status.code, SpanStatusCode.OK)
    equal(span.attributes['http.request.method'], 'GET')
    equal(span.attributes['http.route'], '/custom-pages')
    equal(span.attributes['url.path'], '/custom-pages')
    equal(span.attributes['http.response.status_code'], 200)
    equal(span.attributes['url.scheme'], 'http')
    const resource = span.resource
    deepEqual(resource.attributes['service.name'], 'test-service')
    deepEqual(resource.attributes['service.version'], '1.0.0')

    const spanId = span._spanContext.spanId
    const traceId = span._spanContext.traceId
    const parentSpanId = span.parentSpanContext?.spanId

    // Check that the traceId is the same and the http span is the parent of the db span
    equal(traceId, dbTraceId)
    equal(dbParentSpanId, spanId) // the db span is the child of the http span
    ok(!parentSpanId) // the http span has no parent
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
  const httpSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)
  ok(httpSpan, 'Should have HTTP request span')
  equal(httpSpan.name, 'POST /pages-in-transaction')
  equal(httpSpan.status.code, SpanStatusCode.OK)
  equal(httpSpan.attributes['http.request.method'], 'POST')
  equal(httpSpan.attributes['http.route'], '/pages-in-transaction')
  equal(httpSpan.attributes['url.path'], '/pages-in-transaction')
  equal(httpSpan.attributes['http.response.status_code'], 200)

  const httpSpanId = httpSpan._spanContext.spanId
  const httpTraceId = httpSpan._spanContext.traceId

  // Verify all DB spans are part of the same trace as the HTTP request
  for (const dbTraceId of dbTraceIds) {
    equal(dbTraceId, httpTraceId, 'DB spans should have same traceId as HTTP span')
  }

  // Verify all DB spans are children of the HTTP span
  for (const dbParentSpanId of dbParentSpanIds) {
    equal(dbParentSpanId, httpSpanId, 'DB spans should be children of HTTP span')
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
