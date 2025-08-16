'use strict'

const { deepStrictEqual } = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should handle a lot of runtime api requests', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const promises = []
  for (let i = 0; i < 100; i++) {
    promises.push(app.getServiceDetails('with-logger'))
  }

  await Promise.all(promises)
})

test('should handle service mesh timeouts', async t => {
  const configFile = join(fixturesDir, 'network-timeout', 'platformatic.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const url = await app.start()
  const response = await fetch(url + '/')

  deepStrictEqual(response.status, 500)
  deepStrictEqual(await response.json(), { statusCode: 500, error: 'Internal Server Error', message: 'fetch failed' })
})
