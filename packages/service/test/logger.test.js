import assert from 'node:assert'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { create } from '../index.js'
import { waitForLogLine } from './helper.js'

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

  const log = await waitForLogLine(
    file,
    log =>
      log.level === 'DEBUG' &&
      log.time.length === 24 && // isotime
      log.secret === '***HIDDEN***' &&
      log.name === 'service' &&
      log.msg === 'call route /logs'
  )

  assert.ok(log)
})
