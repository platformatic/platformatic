import { ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import getPort from 'get-port'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const COLLECTION_INTERVAL = 1000

async function startRuntime (t) {
  const port = await getPort()

  const app = await createRuntime(join(fixturesDir, 'prom-server'), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/2.48.0.json',
    entrypoint: 'main',
    watch: false,
    autoload: {
      path: './services'
    },
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: {
      hostname: '127.0.0.1',
      port,
      collection: 'interval',
      collectionInterval: COLLECTION_INTERVAL
    },
    workers: 1
  })

  await app.start()

  t.after(async () => {
    await app.close()
  })

  return { app, port }
}

test('interval collection does not expose the metrics endpoint but keeps the health probes', async t => {
  const { port } = await startRuntime(t)

  const metrics = await request(`http://127.0.0.1:${port}/metrics`)
  strictEqual(metrics.statusCode, 404)
  await metrics.body.dump()

  const ready = await request(`http://127.0.0.1:${port}/ready`)
  strictEqual(ready.statusCode, 200)
  await ready.body.dump()
})

test('interval collection reads the metrics while there are listeners', async t => {
  const { app } = await startRuntime(t)

  const [event] = await once(app, 'metrics:prometheus', { signal: AbortSignal.timeout(COLLECTION_INTERVAL * 5) })
  ok(Array.isArray(event.metrics))
  ok(typeof event.timestamp === 'number')

  // getMetrics() returns the last collection without reading the metrics again
  let emitted = 0
  app.on('metrics:prometheus', () => {
    emitted++
  })

  const { metrics, timestamp } = await app.getMetrics('json')
  strictEqual(emitted, 0)
  ok(timestamp >= event.timestamp)
  ok(Array.isArray(metrics))
})

test('interval collection does not read the metrics without listeners', async t => {
  const { app } = await startRuntime(t)

  // Several intervals without listeners: nothing is read
  await sleep(COLLECTION_INTERVAL * 2.5)

  // Without a previous read, getMetrics() reads the metrics itself and emits them
  let emitted = 0
  app.on('metrics:prometheus', () => {
    emitted++
  })

  await app.getMetrics('json')
  strictEqual(emitted, 1)
})
