'use strict'

const os = require('node:os')
const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { writeFile } = require('node:fs/promises')
const { request } = require('undici')
const { createStackableFromConfig, buildConfig } = require('./helper')

test('should not configure telemetry if not configured', async t => {
  const app = await createStackableFromConfig(
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

  const app = await createStackableFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      },

      telemetry: {
        serviceName: 'test-service',
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
  const finishedSpans = exporters[0].getFinishedSpans()
  assert.strictEqual(finishedSpans.length, 1)
  const span = finishedSpans[0]
  assert.strictEqual(span.name, 'GET /')
  assert.strictEqual(span.attributes['http.request.method'], 'GET')
  assert.strictEqual(span.attributes['http.route'], '/')
  assert.strictEqual(span.attributes['url.path'], '/')
  assert.strictEqual(span.attributes['http.response.status_code'], 200)
})
