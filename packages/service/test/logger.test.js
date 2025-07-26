import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { setTimeout as wait } from 'node:timers/promises'
import { request } from 'undici'
import { create } from '../index.js'

test('logger options', async t => {
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  const file = path.join(process.env.LOG_DIR, 'service.log')
  const serviceRoot = path.join(import.meta.dirname, 'fixtures', 'logger-options')

  const app = await create(serviceRoot)
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
