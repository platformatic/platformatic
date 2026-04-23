import { ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { kIsSubprocessHost } from '../lib/worker/symbols.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const isWindows = process.platform === 'win32'

test(
  'health metrics for a thread-only worker are read from the worker handle, not via ITC',
  { skip: isWindows && 'Skipping on Windows' },
  async t => {
    const configFile = join(fixturesDir, 'child-process-health', 'platformatic.json')

    const app = await createRuntime(configFile)

    t.after(async () => {
      await app.close()
    })

    await app.start()

    // Find the entrypoint worker (runs as a Node worker thread — no subprocess)
    // and the subprocess worker (spawned via `application.commands.development`).
    const workers = await app.getWorkers(true)
    const entrypoint = Object.values(workers).find(w => w.application === 'entrypoint').raw
    const subprocess = Object.values(workers).find(w => w.application === 'subprocess').raw

    ok(!entrypoint[kIsSubprocessHost], 'entrypoint worker should not be flagged as subprocess host')
    strictEqual(subprocess[kIsSubprocessHost], true, 'subprocess worker should be flagged as subprocess host')

    // Collect one health sample for each application and ensure both shapes are valid.
    const seen = new Map()
    while (seen.size < 2) {
      const [m] = await once(app, 'application:worker:health:metrics')
      if (!seen.has(m.application)) {
        seen.set(m.application, m)
      }
    }

    for (const [applicationId, metric] of seen) {
      ok(metric.currentHealth, `${applicationId} should have currentHealth`)
      ok(typeof metric.currentHealth.elu === 'number', `${applicationId} should have ELU`)
      ok(
        typeof metric.currentHealth.heapUsed === 'number' || metric.currentHealth.heapUsed === null,
        `${applicationId} should expose heapUsed`
      )
    }
  }
)

test(
  'health metrics keep flowing while a thread worker is blocking its event loop',
  { skip: isWindows && 'Skipping on Windows' },
  async t => {
    const configFile = join(fixturesDir, 'child-process-health', 'platformatic.json')

    const app = await createRuntime(configFile)

    t.after(async () => {
      await app.close()
    })

    await app.start()

    // Wait for at least one baseline health metric from the entrypoint so we
    // know the collection loop is running.
    while (true) {
      const [m] = await once(app, 'application:worker:health:metrics')
      if (m.application === 'entrypoint') break
    }

    // Block the entrypoint worker's event loop for 4s. If getWorkerHealth
    // were routed through ITC for thread workers (as it was before this
    // patch), the postMessage response would be delayed by the block and the
    // whole health loop would stall. Reading from the worker handle directly
    // doesn't depend on the blocked loop, so metrics should keep arriving.
    const blockMs = 4000
    const blockPromise = app.inject('entrypoint', { method: 'GET', url: `/block/${blockMs}` })

    const startedAt = Date.now()
    let samplesDuringBlock = 0
    while (Date.now() - startedAt < blockMs - 500) {
      const [m] = await once(app, 'application:worker:health:metrics')
      if (m.application === 'entrypoint') samplesDuringBlock++
    }

    await blockPromise

    ok(
      samplesDuringBlock >= 2,
      `expected multiple entrypoint health samples during the ${blockMs}ms block, got ${samplesDuringBlock}`
    )
  }
)
