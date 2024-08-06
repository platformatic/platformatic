'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { request } = require('undici')
const { buildServer } = require('..')
const { buildConfigManager, getConnectionInfo, createBasicPages } = require('./helper')

const getSpanPerType = (spans, type = 'http') => {
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
  return spans.find(span => span.attributes[attibuteToLookFor])
}

test('should not configure telemetry if not configured', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    db: {
      ...connectionInfo,
    },
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  assert.equal(app.openTelemetry, undefined)
})

test('should setup telemetry if configured', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      },
    },
    telemetry: {
      serviceName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory',
      },
    },
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

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
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
    }),
  })
  assert.equal(res.statusCode, 200, 'savePage status code')
  const { exporters } = app.openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()
  assert.equal(finishedSpans.length, 3)
  const graphqlSpan = getSpanPerType(finishedSpans, 'graphql')
  const dbSpan = getSpanPerType(finishedSpans, 'db')
  const httpSpan = getSpanPerType(finishedSpans, 'http')
  assert.equal(graphqlSpan.name, 'mutation savePage')
  assert.equal(graphqlSpan.attributes['graphql.document'], JSON.stringify({ query }))
  assert.equal(graphqlSpan.attributes['graphql.operation.name'], 'savePage')
  assert.equal(graphqlSpan.attributes['graphql.operation.type'], 'mutation')
  assert.equal(httpSpan.name, 'POST /graphql')
  assert.equal(httpSpan.attributes['http.request.method'], 'POST')
  assert.equal(httpSpan.attributes['url.path'], '/graphql')
  assert.equal(httpSpan.attributes['http.response.status_code'], 200)
  assert.equal(dbSpan.name, 'pg.query:INSERT INTO public.pages (title)VALUES ($1)RETURNING id, title')
  assert.equal(dbSpan.attributes['db.system'], 'postgresql')
  assert.equal(dbSpan.attributes['db.statement'], 'INSERT INTO public.pages (title)\nVALUES ($1)\nRETURNING id, title')
})
