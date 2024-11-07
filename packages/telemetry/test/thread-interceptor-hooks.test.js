'use strict'

// const assert = require('node:assert')
const { resolve, join } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { parseNDJson } = require('./helper')
const { setTimeout: sleep } = require('node:timers/promises')

process.setMaxListeners(100)

let createRuntime

const getSpans = async (spanPaths) => {
  const spans = await parseNDJson(spanPaths)
  return spans
}

test.before(async () => {
  const { createRuntime: create, setFixturesDir } = await import('../../basic/test/helper.js')
  const fixturesDir = resolve(__dirname, './fixtures')
  createRuntime = create
  setFixturesDir(fixturesDir)
})

test('should configure metrics correctly with both node and http metrics', async t => {
  const app = await createRuntime(t,
    'node-api-with-telemetry',
    false,
    false,
    'platformatic.json'
  )
  const { url, root } = app
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  await request(`${url}/test`, {
    method: 'GET',
  })
  await sleep(500)
  const spans = await getSpans(spansPath)
  // TODO: Complete the test!!!
  console.log(spans)
})
