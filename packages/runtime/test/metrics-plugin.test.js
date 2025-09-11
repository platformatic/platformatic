import { deepStrictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should allow to attach custom metrics to the prometheus server', async t => {
  const configFile = join(fixturesDir, 'prom-server', 'custom-routes.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const res = await request('http://localhost:9090/custom-prometheus-route')
  deepStrictEqual(await res.body.json(), { ok: true })
})
