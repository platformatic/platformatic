'use strict'

const { buildConfig } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { join } = require('path')
const os = require('os')
const { writeFile } = require('fs/promises')

test('should not configure telemetry if not configured', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()
  equal(app.openTelemetry, undefined)
})

test('should setup telemetry if configured', async ({ teardown, equal, pass, same }) => {
  const file = join(os.tmpdir(), `${process.pid}-1.js`)

  await writeFile(file, `
    module.exports = async function (app, options) {
      app.get('/', () => options.message)
    }`)

  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },

    telemetry: {
      serviceName: 'test-service',
      version: '1.0.0',
      exporter: {
        type: 'memory'
      }
    },
    plugins: {
      paths: [{
        path: file,
        options: {
          message: 'hello'
        }
      }]
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

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
  equal(res.statusCode, 200, 'savePage status code')
  const { exporter } = app.openTelemetry
  const finishedSpans = exporter.getFinishedSpans()
  equal(finishedSpans.length, 1)
  const span = finishedSpans[0]
  equal(span.name, 'GET /')
  equal(span.attributes['http.request.method'], 'GET')
  equal(span.attributes['url.path'], '/')
  equal(span.attributes['http.response.status_code'], 200)
})
