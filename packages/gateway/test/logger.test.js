import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { setTimeout as wait } from 'node:timers/promises'
import { create } from '../index.js'

test('should use logger options - formatters, timestamp, redact', async t => {
  process.env.LOG_DIR = path.join(tmpdir(), 'test-logs', Date.now().toString())
  const file = path.join(process.env.LOG_DIR, 'application.log')
  const applicationRoot = path.join(import.meta.dirname, 'logger')

  const app = await create(applicationRoot, path.resolve(applicationRoot, 'platformatic.json'))
  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

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
        log.level === 'INFO' &&
        log.time.length === 24 && // isotime
        log.name === 'application' &&
        log.msg.startsWith('Server listening at http://127.0.0.1')
    )
  )
})
