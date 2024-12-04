'use strict'

const { equal } = require('node:assert')
const { resolve, join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { parseNDJson, createPGDataBase } = require('./helper.js')
const { setTimeout: sleep } = require('node:timers/promises')
// const { SpanKind } = require('@opentelemetry/api')

process.setMaxListeners(100)

let basicHelper

const getSpans = async (spanPaths) => {
  const spans = await parseNDJson(spanPaths)
  return spans
}

test.beforeEach(async () => {
  basicHelper = await import('../../basic/test/helper.js')
  const fixturesDir = resolve(__dirname, './fixtures')
  basicHelper.setFixturesDir(fixturesDir)
})

test('configure telemetry correctly with a express app', async t => {
  const { dropTestDB } = await createPGDataBase()

  t.after(async () => {
    await dropTestDB()
  })
  const app = await basicHelper.createRuntime(t,
    'express-api-pg',
    false,
    false,
    'platformatic.json'
  )
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/express/users`, {
    method: 'GET',
  })
  console.log('statusCode', statusCode)
  equal(statusCode, 200)
  await sleep(500)
  const spans = await getSpans(spansPath)
  console.log('spans', spans)
  //
  // equal(spans.length, 1)
  //
  // const [span] = spans
  // equal(span.kind, SpanKind.SERVER)
  // // these asserts will fail when this will be fixed
  // // https://github.com/open-telemetry/opentelemetry-js/issues/5103
  // equal(span.attributes['http.method'], 'GET')
  // equal(span.attributes['http.scheme'], 'http')
  // equal(span.attributes['http.target'], '/test')
  //
  // const resource = span.resource
  // deepEqual(resource._attributes['service.name'], 'test-service-api')
})
