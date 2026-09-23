import createConnectionPool from '@databases/pg'
import fastify from 'fastify'
import { createReadStream } from 'node:fs'
import { createInterface } from 'readline'
import telemetryPlugin from '../lib/telemetry.js'

export async function setupApp (pluginOpts, routeHandler, teardown) {
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

export function parseNDJson (filePath) {
  const ret = []
  const ndjsonStream = createReadStream(filePath, {
    encoding: 'utf-8'
  })

  const readLine = createInterface({
    input: ndjsonStream,
    crlfDelay: Infinity
  })

  return new Promise(resolve => {
    readLine.on('line', line => {
      const parsed = JSON.parse(line)
      ret.push(parsed)
    })

    readLine.on('close', () => {
      resolve(ret)
    })
  })
}

export function findParentSpan (spans, startSpan, type, name) {
  let currentSpan = startSpan
  while (currentSpan) {
    const parentSpan = spans.find(span => span.id === currentSpan.parentSpanContext?.spanId)
    if (parentSpan && parentSpan.kind === type && parentSpan.name === name) {
      return parentSpan
    }
    currentSpan = parentSpan
  }
}

export function findSpanWithParentWithId (spans, startSpan, id) {
  let currentSpan = startSpan
  while (currentSpan) {
    const parentSpan = spans.find(span => span.id === currentSpan.parentSpanContext?.spanId)
    if (parentSpan && parentSpan.id === id) {
      return currentSpan
    }
    currentSpan = parentSpan
  }
}

export async function createPGDataBase () {
  const testDBName = 'test-telemetry-pg'
  const connectionString = 'postgres://postgres:postgres@127.0.0.1/'

  const db = await createConnectionPool({
    log: {
      debug: () => {},
      info: () => {},
      trace: () => {},
      error: () => {}
    },
    connectionString,
    poolSize: 1
  })
  const { sql } = db
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
    }
  }
}
