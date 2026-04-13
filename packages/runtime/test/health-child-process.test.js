import { ok } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const isWindows = process.platform === 'win32'

// The subprocess fixture allocates ~50MB of V8 heap in the child process.
// If health metrics are correctly forwarded from the child process, heapUsed
// should reflect that allocation (~70MB+). If they come from the coordinator
// worker thread instead (the bug), heapUsed will be ~24MB.
const HEAP_THRESHOLD = 40 * 1024 * 1024 // 40MB

test('health metrics for child process should reflect subprocess memory, not coordinator thread', { skip: isWindows && 'Skipping on Windows' }, async t => {
  const configFile = join(fixturesDir, 'child-process-health', 'platformatic.json')

  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  // Wait for health metrics for the subprocess service
  let metric
  while (true) {
    const [m] = await once(app, 'application:worker:health:metrics')
    if (m.application === 'subprocess') {
      metric = m
      break
    }
  }

  ok(metric.currentHealth, 'Should have currentHealth')
  ok(typeof metric.currentHealth.elu === 'number', 'Should have ELU metric')
  ok(typeof metric.currentHealth.heapUsed === 'number', 'Should have heapUsed metric')
  ok(typeof metric.currentHealth.heapTotal === 'number', 'Should have heapTotal metric')

  // This is the key assertion: the child process allocates ~50MB of objects.
  // If we're reading from the coordinator thread, heapUsed will be ~24MB.
  // If we're reading from the actual child process, heapUsed will be ~70MB+.
  ok(
    metric.currentHealth.heapUsed > HEAP_THRESHOLD,
    `heapUsed should reflect child process memory (>40MB), got ${(metric.currentHealth.heapUsed / 1024 / 1024).toFixed(1)}MB. ` +
    'This likely means health metrics are coming from the coordinator thread, not the child process.'
  )
})
