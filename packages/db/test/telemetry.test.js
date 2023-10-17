'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { request } = require('undici')
const { buildServer } = require('..')
const { buildConfigManager, getConnectionInfo, createBasicPages } = require('./helper')

test('should not configure telemetry if not configured', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connectionInfo
    }
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
      port: 0
    },
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    },
    telemetry: {
      serviceName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  const res = await request(`${app.url}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `
    })
  })
  assert.equal(res.statusCode, 200, 'savePage status code')
  const { exporters } = app.openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()
  assert.equal(finishedSpans.length, 1)
  const span = finishedSpans[0]
  assert.equal(span.name, 'POST /graphql')
  assert.equal(span.attributes['http.request.method'], 'POST')
  assert.equal(span.attributes['url.path'], '/graphql')
  assert.equal(span.attributes['http.response.status_code'], 200)
})
