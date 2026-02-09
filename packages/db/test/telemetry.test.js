import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { request } from 'undici'
import {
  createBasicPages,
  createFromConfig,
  expectedPort,
  expectedTelemetryPrefix,
  getConnectionInfo,
  isMariaDB,
  isMysql,
  isMysql8,
  isPg,
  isSQLite
} from './helper.js'

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

test('should not configure telemetry if not configured', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  assert.equal(app.getApplication().openTelemetry, undefined)
})

test('should setup telemetry if configured', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    },
    telemetry: {
      applicationName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  const query = `
    mutation {
      savePage(input: { title: "Hello" }) {
        id
        title
      }
    }
  `

  const res = await request(`${app.url}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query
    })
  })
  assert.equal(res.statusCode, 200, 'savePage status code')
  const { exporters } = app.getApplication().openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()
  const graphqlSpans = getSpansPerType(finishedSpans, 'graphql')
  const dbSpans = getSpansPerType(finishedSpans, 'db')
  const httpSpans = getSpansPerType(finishedSpans, 'http')
  assert.equal(graphqlSpans.length, 1)
  const graphqlSpan = graphqlSpans[0]
  assert.equal(graphqlSpan.name, 'mutation savePage')
  assert.equal(graphqlSpan.attributes['graphql.document'], JSON.stringify({ query }))
  assert.equal(graphqlSpan.attributes['graphql.operation.name'], 'savePage')
  assert.equal(graphqlSpan.attributes['graphql.operation.type'], 'mutation')
  assert.equal(httpSpans.length, 1)
  const httpSpan = httpSpans[0]
  assert.equal(httpSpan.name, 'POST /graphql')
  assert.equal(httpSpan.attributes['http.request.method'], 'POST')
  assert.equal(httpSpan.attributes['url.path'], '/graphql')
  assert.equal(httpSpan.attributes['http.response.status_code'], 200)
  // DB span
  const dbname = connectionInfo.dbname
  if (isPg) {
    assert.equal(dbSpans.length, 1)
    const dbSpan = dbSpans[0]
    assert.ok(dbSpan.name.startsWith('pg.query:'))
    assert.equal(dbSpan.attributes['db.system'], 'postgresql')
    assert.equal(dbSpan.attributes['db.user'], 'postgres')
    assert.equal(dbSpan.attributes['db.name'], dbname)
    assert.equal(dbSpan.attributes['net.peer.name'], '127.0.0.1')
    assert.equal(dbSpan.attributes['net.peer.port'], expectedPort)
    assert.equal(
      dbSpan.attributes['db.statement'],
      'INSERT INTO public.pages (title)\nVALUES ($1)\nRETURNING id, title'
    )
  } else if (isMysql || isMysql8 || isMariaDB) {
    // Mysql-like do 2 queries, one for the insert and one for the select
    assert.equal(dbSpans.length, 2)

    // Insert
    const dbSpan1 = dbSpans[0]
    assert.ok(dbSpan1.name.startsWith('mysql.query:'))
    assert.equal(dbSpan1.attributes['db.system'], 'mysql')
    assert.equal(dbSpan1.attributes['db.user'], 'root')
    assert.equal(dbSpan1.attributes['net.peer.name'], '127.0.0.1')
    assert.equal(dbSpan1.attributes['net.peer.port'], expectedPort)

    // Select
    const dbSpan2 = dbSpans[1]
    assert.ok(dbSpan2.name.startsWith('mysql.query:'))
    assert.equal(dbSpan2.attributes['db.system'], 'mysql')
    assert.equal(dbSpan2.attributes['db.user'], 'root')
    assert.equal(dbSpan2.attributes['net.peer.name'], '127.0.0.1')
    assert.equal(dbSpan2.attributes['net.peer.port'], expectedPort)
  } else if (isSQLite) {
    assert.equal(dbSpans.length, 2)
    const dbSpan1 = dbSpans[0]
    assert.ok(dbSpan1.name.startsWith('sqlite.query:'))
    assert.equal(dbSpan1.attributes['db.system'], 'sqlite')

    const dbSpan2 = dbSpans[1]
    assert.ok(dbSpan2.name.startsWith('sqlite.query:'))
    assert.equal(dbSpan2.attributes['db.system'], 'sqlite')
  }
})

async function setupDBAppWithTelemetry (t, telemetryOpts, plugins) {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      },
      db: {
        ...connectionInfo,
        onDatabaseLoad
      },
      telemetry: telemetryOpts
    },
    null,
    { skipInit: true }
  )

  app.context.fastifyPlugins = plugins

  t.after(async () => {
    await app.stop()
    await dropTestDB()
    const { exporters } = app.getApplication().openTelemetry
    exporters.forEach(exporter => {
      if (exporter.constructor.name === 'InMemorySpanExporter') {
        exporter.reset()
      }
    })
  })

  await app.start({ listen: true })
  return app
}

async function onDatabaseLoad (db, sql) {
  await createBasicPages(db, sql)
}

test('should trace a request in a platformatic DB app', async t => {
  const app = await setupDBAppWithTelemetry(t, {
    applicationName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  })

  const { exporters } = app.getApplication().openTelemetry
  const exporter = exporters[0]
  exporter.reset() //  we reset to avoid the queies to load all the metadata

  const res = await app.inject({
    method: 'GET',
    url: '/pages'
  })
  assert.equal(res.statusCode, 200, '/pages status code')

  const finishedSpans = exporter.getFinishedSpans()
  assert.equal(finishedSpans.length, 2)

  let dbTraceId, dbParentSpanId
  {
    // DB query span
    const span = finishedSpans[0]
    assert.equal(span.kind, SpanKind.CLIENT) // this is the db client span
    const expectedName = `${expectedTelemetryPrefix}.query:`
    const expectedNameRE = new RegExp(`^${expectedName}`)
    assert.match(span.name, expectedNameRE)
    assert.match(span.attributes['db.statement'], /^SELECT id, title/)
    const resource = span.resource
    assert.deepEqual(resource.attributes['service.name'], 'test-service')
    assert.deepEqual(resource.attributes['service.version'], '1.0.0')
    dbTraceId = span.spanContext().traceId
    dbParentSpanId = span.parentSpanContext.spanId
  }
  {
    // HTTP request span
    const span = finishedSpans[1]
    assert.equal(span.kind, SpanKind.SERVER)
    assert.equal(span.name, 'GET /pages')
    assert.equal(span.status.code, SpanStatusCode.OK)
    assert.equal(span.attributes['http.request.method'], 'GET')
    assert.equal(span.attributes['url.path'], '/pages')
    assert.equal(span.attributes['http.response.status_code'], 200)
    assert.equal(span.attributes['url.scheme'], 'http')
    const resource = span.resource
    assert.deepEqual(resource.attributes['service.name'], 'test-service')
    assert.deepEqual(resource.attributes['service.version'], '1.0.0')

    const spanId = span._spanContext.spanId
    const traceId = span._spanContext.traceId
    const parentSpanId = span.parentSpanContext?.spanId

    // Check that the traceId is the same and the http span is the parent of the db span
    assert.equal(traceId, dbTraceId)
    assert.equal(dbParentSpanId, spanId) // the db span is the child of the http span
    assert.ok(!parentSpanId) // the http span has no parent
  }
})

test('should trace a request getting DB from the request and running the query manually', async t => {
  const plugin = async app => {
    app.get('/custom-pages', async (request, _reply) => {
      const db = request.getDB()
      const { sql } = app.platformatic
      const pages = await db.query(sql`SELECT id, title FROM pages;`)
      return pages
    })
  }

  const app = await setupDBAppWithTelemetry(
    t,
    {
      applicationName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    [plugin]
  )
  const { exporters } = app.getApplication().openTelemetry
  const exporter = exporters[0]
  exporter.reset() //  we reset to avoid the queies to load all the metadata

  const res = await app.inject({
    method: 'GET',
    url: '/custom-pages'
  })
  assert.equal(res.statusCode, 200, '/custom-pages status code')

  const finishedSpans = exporter.getFinishedSpans()
  assert.equal(finishedSpans.length, 2)

  let dbTraceId, dbParentSpanId
  {
    // DB query span
    const span = finishedSpans[0]
    assert.equal(span.kind, SpanKind.CLIENT) // this is the db client span
    const expectedName = `${expectedTelemetryPrefix}.query:`
    const expectedNameRE = new RegExp(`^${expectedName}`)
    assert.match(span.name, expectedNameRE)
    assert.match(span.attributes['db.statement'], /^SELECT id, title/)
    const resource = span.resource
    assert.deepEqual(resource.attributes['service.name'], 'test-service')
    assert.deepEqual(resource.attributes['service.version'], '1.0.0')
    dbTraceId = span.spanContext().traceId
    dbParentSpanId = span.parentSpanContext.spanId
  }
  {
    // HTTP request span
    const span = finishedSpans[1]
    assert.equal(span.kind, SpanKind.SERVER)
    assert.equal(span.name, 'GET /custom-pages')
    assert.equal(span.status.code, SpanStatusCode.OK)
    assert.equal(span.attributes['http.request.method'], 'GET')
    assert.equal(span.attributes['url.path'], '/custom-pages')
    assert.equal(span.attributes['http.response.status_code'], 200)
    assert.equal(span.attributes['url.scheme'], 'http')
    const resource = span.resource
    assert.deepEqual(resource.attributes['service.name'], 'test-service')
    assert.deepEqual(resource.attributes['service.version'], '1.0.0')

    const spanId = span._spanContext.spanId
    const traceId = span._spanContext.traceId
    const parentSpanId = span.parentSpanContext?.spanId

    // Check that the traceId is the same and the http span is the parent of the db span
    assert.equal(traceId, dbTraceId)
    assert.equal(dbParentSpanId, spanId) // the db span is the child of the http span
    assert.ok(!parentSpanId) // the http span has no parent
  }
})
