'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const path = require('node:path')
const { readFileSync } = require('node:fs')
const { setTimeout: wait } = require('node:timers/promises')
const { tmpdir } = require('node:os')
const { createStackable } = require('..')
const { getConnectionInfo } = require('./helper')

const WAIT_LOGS_FLUSH = 3_000

test('logger options', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  process.env.DATABASE_CONNECTION_STRING = connectionInfo.connectionString
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  const file = path.join(process.env.LOG_DIR, 'service.log')

  const app = await createStackable(path.join(__dirname, 'fixtures', 'logger'))

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  await wait(WAIT_LOGS_FLUSH)
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
        log.name === 'db-service' &&
        log.msg === 'computed schema'
    )
  )
  assert.ok(
    logs.find(
      log =>
        log.level === 'WARN' &&
        log.time.length === 24 && // isotime
        log.name === 'db-service' &&
        log.msg.startsWith('No tables found in the database')
    )
  )
  assert.ok(
    logs.find(
      log =>
        log.level === 'INFO' &&
        log.time.length === 24 && // isotime
        log.name === 'db-service' &&
        log.msg.startsWith('Server listening at http://127.0.0.1:')
    )
  )
})
