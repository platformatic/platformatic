import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { findWranglerConfigFile, loadWranglerConfig } from '../index.js'
import { loadDevVars } from '../lib/wrangler.js'

async function createRoot (t, files) {
  const root = await mkdtemp(resolve(tmpdir(), 'plt-lavoratore-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  for (const [name, contents] of Object.entries(files)) {
    await writeFile(resolve(root, name), contents)
  }

  return root
}

test('finds the Wrangler configuration file using the Wrangler order', async t => {
  const root = await createRoot(t, { 'wrangler.toml': '', 'wrangler.jsonc': '{}' })

  strictEqual(findWranglerConfigFile(root), resolve(root, 'wrangler.jsonc'))
  strictEqual(findWranglerConfigFile(root, 'custom.toml'), resolve(root, 'custom.toml'))
  strictEqual(findWranglerConfigFile(await createRoot(t, {})), null)
})

test('returns an empty configuration when there is no Wrangler configuration file', async t => {
  deepStrictEqual(await loadWranglerConfig(await createRoot(t, {})), { path: null, config: {} })
})

test('applies Wrangler environments without inheriting bindings', async t => {
  const root = await createRoot(t, {
    'wrangler.json': JSON.stringify({
      main: 'index.js',
      vars: { A: '1' },
      kv_namespaces: [{ binding: 'KV', id: 'top' }],
      env: { staging: { compatibility_date: '2025-01-01', vars: { B: '2' } } }
    })
  })

  deepStrictEqual((await loadWranglerConfig(root)).config, {
    main: 'index.js',
    vars: { A: '1' },
    kv_namespaces: [{ binding: 'KV', id: 'top' }]
  })

  deepStrictEqual((await loadWranglerConfig(root, null, 'staging')).config, {
    main: 'index.js',
    compatibility_date: '2025-01-01',
    vars: { B: '2' }
  })

  await rejects(loadWranglerConfig(root, null, 'missing'), /Environment "missing" not found/)
})

test('loads .dev.vars, preferring the environment specific file', async t => {
  const root = await createRoot(t, { '.dev.vars': 'A=1\nB="two"', '.dev.vars.staging': 'A=staging' })

  deepStrictEqual(await loadDevVars(root), { A: '1', B: 'two' })
  deepStrictEqual(await loadDevVars(root, 'staging'), { A: 'staging' })
  deepStrictEqual(await loadDevVars(await createRoot(t, {})), {})
})
