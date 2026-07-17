import { deepStrictEqual, equal, ok, rejects } from 'node:assert'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import schedulerModule, { SCHEDULER_MANIFEST_FILENAME } from '../lib/scheduler/module.js'

function createNitroMock () {
  const hooks = {}

  return {
    options: {
      scheduledTasks: { '* * * * *': 'log' },
      output: {}
    },
    hooks: {
      hook (name, fn) {
        hooks[name] = fn
      }
    },
    _hooks: hooks
  }
}

test('moves scheduled tasks to the Platformatic runtime plugin', () => {
  const nitro = createNitroMock()
  schedulerModule(nitro)

  deepStrictEqual(nitro.options.scheduledTasks, {})
  equal(nitro.options.experimental.tasks, true)
  deepStrictEqual(nitro.options.runtimeConfig.platformaticScheduler.scheduledTasks, [
    { id: '0', cron: '* * * * *', tasks: ['log'] }
  ])
  equal(nitro.options.plugins.length, 1)
  ok(nitro.options.plugins[0].endsWith('runtime.mjs'))
})

test('preserves existing Nitro configuration', () => {
  const nitro = createNitroMock()
  nitro.options.experimental = { tasks: false }
  nitro.options.plugins = ['existing-plugin.mjs']
  nitro.options.runtimeConfig = { existing: true }

  schedulerModule(nitro)

  equal(nitro.options.experimental.tasks, true)
  equal(nitro.options.plugins.length, 2)
  equal(nitro.options.runtimeConfig.existing, true)
})

test('uses the Nitro 3 runtime plugin for Nitro 3', () => {
  const nitro = createNitroMock()
  nitro.meta = { majorVersion: 3 }

  schedulerModule(nitro)

  ok(nitro.options.plugins[0].endsWith('runtime-nitro.mjs'))
})

test('emits the manifest in the build output', async () => {
  const nitro = createNitroMock()
  schedulerModule(nitro)

  const serverDir = await mkdtemp(join(tmpdir(), 'plt-nitro-scheduler-module-'))
  nitro.options.output.serverDir = serverDir
  await nitro._hooks.compiled()

  const manifest = JSON.parse(await readFile(join(serverDir, SCHEDULER_MANIFEST_FILENAME), 'utf8'))
  deepStrictEqual(manifest, {
    version: 1,
    scheduledTasks: [{ id: '0', cron: '* * * * *', tasks: ['log'] }]
  })
})

test('does not emit a manifest in development', async () => {
  const nitro = createNitroMock()
  nitro.options.dev = true
  schedulerModule(nitro)

  const serverDir = await mkdtemp(join(tmpdir(), 'plt-nitro-scheduler-module-'))
  nitro.options.output.serverDir = serverDir
  await nitro._hooks.compiled()

  await rejects(readFile(join(serverDir, SCHEDULER_MANIFEST_FILENAME)), { code: 'ENOENT' })
})
