'use strict'

const { equal } = require('node:assert')
const { resolve, join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { parseNDJson, createPGDataBase } = require('./helper.js')

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
  equal(statusCode, 200)
  const spans = await getSpans(spansPath)
  const dbSpan = spans.find(span => span.name === 'pg.query:SELECT test-telemetry-pg')
  const statement = dbSpan.attributes['db.statement']
  equal(statement, 'SELECT * FROM users')
})
