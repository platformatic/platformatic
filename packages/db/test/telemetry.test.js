'use strict'

const { buildConfig, connInfo, clear, createBasicPages } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')

test('should not configure telemetry if not configured', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connInfo
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()
  equal(app.openTelemetry, undefined)
})

test('should setup telemetry if configured', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')
        await clear(db, sql)
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
  }))

  teardown(async () => {
    await app.close()
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
  equal(res.statusCode, 200, 'savePage status code')
  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const span = finishedSpans[0]
  equal(span.name, 'POST /graphql')
  equal(span.attributes['req.method'], 'POST')
  equal(span.attributes['req.url'], '/graphql')
  equal(span.attributes['reply.statusCode'], 200)
})
