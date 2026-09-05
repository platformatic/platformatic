import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create, loadConfiguration } from '../index.js'

const fixture = join(import.meta.dirname, '..', 'fixtures', 'v4-monorepo')

async function boot (t) {
  const runtime = await create(fixture, null, { production: false, setupSignals: false })

  t.after(() => runtime.close())

  await runtime.init()
  await runtime.start()
  return runtime
}

test('the runtime loads a watt.config.* project through the v4 loader', async () => {
  const config = await loadConfiguration(fixture, null, { production: false })

  deepStrictEqual(
    config.applications.map(entry => [entry.id, entry.type]),
    [
      ['api', '@platformatic/node'],
      ['frontend', '@platformatic/node']
    ]
  )

  // The capability came from the loader's envelope, so the worker gets data rather than a path to
  // re-read: evaluating configuration exactly once per load is the whole contract.
  for (const entry of config.applications) {
    strictEqual(entry.config, undefined)
    ok(entry.resolvedConfig)
    strictEqual(entry.localUrl, `http://${entry.id}.plt.local`)
  }
})

test('each application boots under its own layered environment', async t => {
  const runtime = await boot(t)

  const api = await runtime.inject('api', { method: 'GET', url: '/' }).then(r => JSON.parse(r.body))
  const frontend = await runtime.inject('frontend', { method: 'GET', url: '/' }).then(r => JSON.parse(r.body))

  // The entry block beats the root block, which beats the env file — and an application with no
  // entry block of its own falls through to the root block.
  strictEqual(api.shared, 'entry')
  strictEqual(frontend.shared, 'root-block')
  strictEqual(api.fromEntry, 'entry')
  strictEqual(frontend.fromEntry, null)

  // The root chain still reaches every application.
  strictEqual(api.fromRootFile, 'root')
  strictEqual(frontend.fromRootBlock, 'block')
})

test('every worker receives the topology URLs, its own included', async t => {
  const runtime = await boot(t)
  const api = await runtime.inject('api', { method: 'GET', url: '/' }).then(r => JSON.parse(r.body))

  strictEqual(api.selfUrl, 'http://api.plt.local')
  strictEqual(api.siblingApi, 'http://api.plt.local')
  strictEqual(api.siblingFrontend, 'http://frontend.plt.local')
})

test('the mesh resolves a sibling by its virtual hostname', async t => {
  const runtime = await boot(t)
  const response = await runtime.inject('api', { method: 'GET', url: 'http://frontend.plt.local/' })

  strictEqual(response.statusCode, 200)
  strictEqual(JSON.parse(response.body).id, 'frontend')
})
