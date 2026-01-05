import assert from 'node:assert'
import { writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { buildConfig, createFromConfig } from './helper.js'

test('should not configure telemetry if not configured', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      }
    })
  )

  test.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })
  assert.strictEqual(app.openTelemetry, undefined)
})

test('should setup telemetry if configured', async t => {
  const file = join(os.tmpdir(), `${process.pid}-1.js`)

  await writeFile(
    file,
    `
    module.exports = async function (app, options) {
      app.get('/', () => options.message)
    }`
  )

  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      },

      telemetry: {
        applicationName: 'test-service',
        version: '1.0.0',
        exporter: {
          type: 'memory'
        }
      },
      plugins: {
        paths: [
          {
            path: file,
            options: {
              message: 'hello'
            }
          }
        ]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/`, {
    method: 'GET',
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
  assert.strictEqual(res.statusCode, 200, 'savePage status code')

  const { exporters } = app.getApplication().openTelemetry

  // Force flush to ensure all spans are exported
  await app.getApplication().openTelemetry.provider.forceFlush()

  const finishedSpans = exporters[0].getFinishedSpans()

  // With @fastify/otel, we get multiple INTERNAL spans + possibly a SERVER span from HttpInstrumentation
  assert.ok(finishedSpans.length >= 1, `Expected at least 1 span, got ${finishedSpans.length}`)

  // HttpInstrumentation doesn't create SERVER spans when Fastify handles the request
  // @fastify/otel creates INTERNAL spans with routing information
  // So we look for the Fastify request INTERNAL span which has the http info
  const requestSpan = finishedSpans.find(s =>
    s.name === 'request' &&
    s.kind === 0 // INTERNAL
  )
  assert.ok(requestSpan, 'Should have Fastify request span')

  // Find the Fastify INTERNAL span with http.route (created by @fastify/otel)
  const fastifySpan = finishedSpans.find(s => s.attributes['http.route'] === '/')
  assert.ok(fastifySpan, 'Should have Fastify span with http.route')
  assert.strictEqual(fastifySpan.attributes['http.route'], '/')
})
