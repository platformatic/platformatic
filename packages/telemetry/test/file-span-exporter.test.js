'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const fastify = require('fastify')
const { tmpdir } = require('node:os')
const { join, dirname } = require('node:path')
const { mkdir, unlink, rmdir } = require('node:fs/promises')
const pid = process.pid
const telemetryPlugin = require('../lib/telemetry')
const { setTimeout: sleep } = require('node:timers/promises')
const { SpanStatusCode, SpanKind } = require('@opentelemetry/api')
const { parseNDJson } = require('./helper')

async function setupApp (pluginOpts, routeHandler, teardown) {
  const app = fastify()
  await app.register(telemetryPlugin, pluginOpts)
  app.get('/test', routeHandler)
  app.ready()
  teardown(async () => {
    await app.close()
    const { exporters } = app.openTelemetry
    exporters.forEach(exporter => {
      if (
        exporter.constructor.name === 'InMemorySpanExporter'
      ) {
        exporter.reset()
      }
    })
  })
  return app
}

const injectArgs = {
  method: 'GET',
  url: '/test',
  headers: {
    host: 'test',
  },
}

test('should trace a request with file exporter', async () => {
  const tmpDir = join(tmpdir(), `plt-file-exporter-${pid}`)
  await mkdir(tmpDir, { recursive: true })
  const filePath = join(tmpDir, 'spans.json')

  const handler = async (_request, _reply) => {
    return { foo: 'bar' }
  }

  const app = await setupApp({
    applicationName: 'test-application',
    version: '1.0.0',
    exporter: {
      type: 'file',
      options: {
        path: filePath
      }
    },
  }, handler, test.after, filePath)

  app.inject(injectArgs, async () => {
    await sleep(500)
    const finishedSpans = await parseNDJson(filePath)
    equal(finishedSpans.length, 1)
    const span = finishedSpans[0]
    equal(span.kind, SpanKind.SERVER)
    equal(span.name, 'GET /test')
    equal(span.status.code, SpanStatusCode.OK)
    equal(span.attributes['http.request.method'], 'GET')
    equal(span.attributes['url.path'], '/test')
    equal(span.attributes['http.response.status_code'], 200)
    equal(span.attributes['url.scheme'], 'http')
    equal(span.attributes['server.address'], 'test')
    await unlink(filePath)
    await rmdir(dirname(filePath))
  })
})
