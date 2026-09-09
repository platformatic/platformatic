import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { defineConfig, version } from '../index.js'

test('defineConfig returns its argument untouched', () => {
  const config = { applications: [{ id: 'api', path: './web/api' }] }

  strictEqual(defineConfig(config), config)
})

test('defineConfig passes a function through for the loader to call', () => {
  // Nothing happens to it here: classification rule 1 calls it once with the config context and
  // classifies its resolved value, so the two forms behave identically at runtime.
  const callback = ctx => ({ watch: ctx.command === 'dev' })

  strictEqual(defineConfig(callback), callback)
})

test('the package entry is light enough to sit in a config file', async () => {
  // A root config is evaluated in a worker on every boot and every dev reload, so everything
  // reachable from this import is paid for there. Reaching the CLI would cost about a second and a
  // half per load.
  const started = performance.now()
  const entry = await import(`../index.js?fresh=${process.hrtime.bigint()}`)
  const elapsed = performance.now() - started

  ok(elapsed < 500, `importing the package entry took ${Math.round(elapsed)}ms`)
  deepStrictEqual(Object.keys(entry).sort(), ['defineConfig', 'main', 'version'])
  ok(!Object.keys(globalThis).includes('__wattpmCliLoaded'))
})

test('the entry still reports the package version and reaches the CLI on demand', async () => {
  ok(/^\d+\.\d+\.\d+/.test(version))

  const { main } = await import('../index.js')

  strictEqual(typeof main, 'function')
})
