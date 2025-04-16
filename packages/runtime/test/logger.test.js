'use strict'

const assert = require('node:assert')
const path = require('node:path')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const { setTimeout: wait } = require('node:timers/promises')
const { request } = require('undici')
const { tmpdir } = require('node:os')
const { buildServer } = require('..')

test('logger options', async t => {
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  process.env.PLT_RUNTIME_LOGGER_STDOUT = 1
  const file = path.join(process.env.LOG_DIR, 'service.log')
  const serviceRoot = path.join(__dirname, '..', 'fixtures', 'logger-options')

  const app = await buildServer(path.join(serviceRoot, 'platformatic.json'))
  t.after(async () => {
    await app.close()
  })
  const url = await app.start()

  await request(url, { path: '/logs' })
  // wait for logger flush
  await wait(500)

  const content = readFileSync(file, 'utf8')
  const logs = content.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line))

  assert.ok(logs.find(log => log.level === 'DEBUG' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Starting the service "app"...'))
  assert.ok(logs.find(log => log.level === 'DEBUG' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg === 'Started the service "app"...'))
  assert.ok(logs.find(log => log.level === 'DEBUG' &&
    log.time.length === 24 && // isotime
    log.name === 'service' &&
    log.msg.startsWith('Platformatic is now listening at http://127.0.0.1:')))
})
