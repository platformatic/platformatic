'use strict'

const assert = require('node:assert')
const path = require('node:path')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const { setTimeout: wait } = require('node:timers/promises')
const { request } = require('undici')
const { tmpdir } = require('node:os')
const { createStackable } = require('..')

test('logger options', async t => {
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  const file = path.join(process.env.LOG_DIR, 'service.log')
  const serviceRoot = path.join(__dirname, 'fixtures', 'logger-options')

  const app = await createStackable(serviceRoot)
  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  await request(app.url, { path: '/logs' })
  // wait for logger flush
  await wait(500)

  const content = readFileSync(file, 'utf8')
  const logs = content
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line))

  assert.ok(
    logs.find(
      log =>
        log.level === 'DEBUG' &&
        log.time.length === 24 && // isotime
        log.secret === '***HIDDEN***' &&
        log.name === 'service' &&
        log.msg === 'call route /logs'
    )
  )
})
