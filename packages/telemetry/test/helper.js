'use strict'

const fastify = require('fastify')
const telemetryPlugin = require('../lib/telemetry')
const { createInterface } = require('readline')
const { createReadStream } = require('node:fs')
const { SpanKind } = require('@opentelemetry/api')
const { createConnectionPool } = require('@platformatic/sql-mapper')

async function setupApp (pluginOpts, routeHandler, teardown) {
  const app = fastify()
  await app.register(telemetryPlugin, pluginOpts)
  app.get('/test', routeHandler)
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

function parseNDJson (filePath) {
  const ret = []
  const ndjsonStream = createReadStream(filePath, {
    encoding: 'utf-8'
  })

  const readLine = createInterface({
    input: ndjsonStream,
    crlfDelay: Infinity
  })

  return new Promise(resolve => {
    readLine.on('line', (line) => {
      const parsed = JSON.parse(line)
      ret.push(parsed)
    })

    readLine.on('close', () => {
      resolve(ret)
    })
  })
}

// this is useful for debuggging
const compatSpans = (spans) => {
  return spans.map(span => {
    let kind
    if (span.kind === SpanKind.SERVER) {
      kind = 'server'
    } else if (span.kind === SpanKind.CLIENT) {
      kind = 'client'
    } else {
      kind = 'internal'
    }

    return {
      id: span.id,
      traceId: span.traceId,
      parentId: span.parentId,
      kind,
      name: span.name
    }
  })
}

const findParentSpan = (spans, startSpan, type, name) => {
  let currentSpan = startSpan
  while (currentSpan) {
    const parentSpan = spans.find(span => span.id === currentSpan.parentId)
    if (parentSpan && parentSpan.kind === type && parentSpan.name === name) {
      return parentSpan
    }
    currentSpan = parentSpan
  }
}

const findSpanWithParentWithId = (spans, startSpan, id) => {
  let currentSpan = startSpan
  while (currentSpan) {
    const parentSpan = spans.find(span => span.id === currentSpan.parentId)
    if (parentSpan && parentSpan.id === id) {
      return currentSpan
    }
    currentSpan = parentSpan
  }
}

async function createPGDataBase () {
  const testDBName = 'test-telemetry-pg'
  const connectionString = 'postgres://postgres:postgres@127.0.0.1/'

  const { db, sql } = await createConnectionPool({
    log: {
      debug: () => {},
      info: () => {},
      trace: () => {},
      error: () => {},
    },
    connectionString,
    poolSize: 1,
  })
  try {
    await db.query(sql`DROP DATABASE IF EXISTS ${sql.ident(testDBName)};`)
  } catch (e) {
    // ignore
  }

  await db.query(sql`CREATE DATABASE ${sql.ident(testDBName)};`)
  return {
    async dropTestDB () {
      await db.query(sql`DROP DATABASE IF EXISTS${sql.ident(testDBName)} WITH (FORCE);`)
      await db.dispose()
    },
  }
}

module.exports = {
  setupApp,
  parseNDJson,
  compatSpans,
  findParentSpan,
  findSpanWithParentWithId,
  createPGDataBase
}
