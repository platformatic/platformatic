import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'
import { events } from '../fixtures/extensions/extension-configure.js'

const root = join(import.meta.dirname, '../fixtures/extensions/configure')

test('configure runs in main after autoload and before application resolution', async () => {
  events.length = 0
  const config = await loadConfiguration(join(root, 'watt.config.js'), null, { ignoreProcessEnv: true })

  deepStrictEqual(events.map(event => event.ids), [['a'], ['a']])
  deepStrictEqual(events.map(event => event.isMainThread), [true, true])
  deepStrictEqual(events.map(event => event.root), [root, root])
  strictEqual(config.applications[0].workerEnv.CONFIGURE_ORDER, 'first-second')
  strictEqual(config.applications[0].resolvedConfig.server.port, 12345)
})

test('configure supports object sources and respects build opt-in', async () => {
  const source = {
    extensions: [{ path: '../extension-configure.js', options: { value: 'build' } }],
    applications: [{ id: 'a', path: '../services/a' }]
  }

  events.length = 0
  await loadConfiguration(root, source, { build: true })
  strictEqual(events.length, 0)

  source.extensions[0].build = true
  const config = await loadConfiguration(root, source, { build: true })
  strictEqual(events.length, 1)
  strictEqual(config.applications[0].workerEnv.CONFIGURE_ORDER, 'build')
})

test('configure failures retain their cause and invalid output is rejected', async () => {
  const source = {
    extensions: [{ path: '../extension-configure.js', options: { fail: true } }],
    applications: [{ id: 'a', path: '../services/a' }]
  }

  await rejects(loadConfiguration(root, source), error => {
    strictEqual(error.code, 'PLT_RUNTIME_FAILED_TO_LOAD_EXTENSION')
    strictEqual(error.cause.code, 'TEST_CONFIGURATION_FAILED')
    return true
  })

  source.extensions[0].options = { invalid: true }
  await rejects(loadConfiguration(root, source), {
    code: 'PLT_INVALID_APPLICATION_CONFIGURATION'
  })
})
