import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { setTimeout as wait } from 'node:timers/promises'
import { request } from 'undici'
import { create } from '../index.js'

// The file transport flushes asynchronously, so poll for the expected line
// instead of waiting a fixed amount of time
async function waitForLogLine (file, predicate, { timeoutMs = 30000, intervalMs = 250 } = {}) {
  const start = Date.now()

  while (true) {
    const logs = []
    try {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '') {
          continue
        }
        try {
          logs.push(JSON.parse(line))
        } catch {
          // The line has been partially written, it will be retried at the next iteration
        }
      }
    } catch {
      // The file has not been created yet
    }

    const found = logs.find(predicate)
    if (found) {
      return found
    }
    if (Date.now() - start > timeoutMs) {
      return undefined
    }
    await wait(intervalMs)
  }
}

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
