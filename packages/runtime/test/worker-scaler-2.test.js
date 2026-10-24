import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const root = join(import.meta.dirname, '../fixtures/worker-scaler')
async function waitFor (read, expected) {
  for (let i = 0; i < 300; i++) {
    if (await read() === expected) return
    await sleep(100)
  }
  assert.equal(await read(), expected)
}

async function start (t, options = {}) {
  const { applicationWorkers, ...workers } = options
  const app = await createRuntime(root, {
    watch: false,
    autoload: { path: './services' },
    applications: [
      { id: 'service-1', path: './services/service-1', workers: 1 },
      { id: 'service-2', path: './services/service-2', workers: applicationWorkers }
    ],
    health: { enabled: false },
    workers: {
      dynamic: true,
      minimum: 1,
      maximum: 2,
      total: 3,
      maxMemory: Number.MAX_SAFE_INTEGER,
      processIntervalMs: 100,
      eluThreshold: 0.2,
      redistributionMs: 0,
      alphaUp: 1,
      alphaDown: 1,
      betaUp: 0,
      betaDown: 0,
      cooldowns: { scaleUpAfterScaleUpMs: 1000, scaleDownAfterScaleUpMs: 1000 },
      ...workers
    }
  })
  t.after(() => app.close())
  await app.start()
  const url = Object.values(app.getUrls('service-1'))[0]
  return { app, url, count: async () => Object.values(await app.getWorkers()).filter(worker => worker.application === 'service-2').length }
}

test('predictive scaling grows under CPU load and shrinks after the load ends', async t => {
  const { url, count } = await start(t)
  const controller = new AbortController()
  const load = (async () => {
    while (!controller.signal.aborted) {
      const response = await request(url + '/service-2/cpu-intensive', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ timeout: 1000 })
      })
      await response.body.dump()
    }
  })()
  try {
    await waitFor(count, 2)
  } finally {
    controller.abort()
    await load
  }
  await waitFor(count, 1)
})

for (const [name, options] of [
  ['memory budget', { maxMemory: 1 }],
  ['application maximum', { maximum: 1 }],
  ['total worker budget', { total: 2 }],
  ['application ELU threshold', { applicationWorkers: { eluThreshold: 1 } }]
]) {
  test(`predictive scaling respects the ${name}`, async t => {
    const { app, count } = await start(t, options)
    for (let i = 0; i < 20; i++) {
      app.emit('application:worker:health:metrics', {
        id: 'service-2:0', application: 'service-2', currentHealth: { elu: 0.95, heapUsed: 1024 * 1024 }
      })
      await sleep(100)
    }
    assert.equal(await count(), 1)
  })
}
