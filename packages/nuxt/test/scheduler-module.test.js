import { deepStrictEqual, equal, ok, rejects } from 'node:assert'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import schedulerModule, { SCHEDULER_MANIFEST_FILENAME } from '../lib/scheduler/module.js'

function createNuxtMock () {
  const hooks = {}

  return {
    hooks,
    nuxt: {
      hook (name, fn) {
        hooks[name] = fn
      }
    }
  }
}

test('moves grouped scheduled tasks to the Platformatic runtime plugin', async () => {
  const { hooks, nuxt } = createNuxtMock()
  schedulerModule({}, nuxt)

  const nitroConfig = {
    scheduledTasks: { '* * * * *': 'log', '0 * * * *': ['a', 'b'] }
  }

  await hooks['nitro:config'](nitroConfig)

  deepStrictEqual(nitroConfig.scheduledTasks, [])
  equal(nitroConfig.experimental.tasks, true)

  deepStrictEqual(nitroConfig.runtimeConfig.platformaticScheduler.scheduledTasks, [
    { id: '0', cron: '* * * * *', tasks: ['log'] },
    { id: '1', cron: '0 * * * *', tasks: ['a', 'b'] }
  ])

  equal(nitroConfig.handlers, undefined)
  equal(nitroConfig.plugins.length, 1)
  ok(nitroConfig.plugins[0].endsWith('runtime.mjs'))
})

test('supports the array configuration format and preserves existing config', async () => {
  const { hooks, nuxt } = createNuxtMock()
  schedulerModule({}, nuxt)

  const nitroConfig = {
    scheduledTasks: [{ cron: '* * * * *', tasks: 'log' }],
    experimental: { tasks: false },
    handlers: [{ route: '/existing', method: 'get', handler: 'existing.mjs' }],
    plugins: ['existing-plugin.mjs'],
    runtimeConfig: { existing: true }
  }

  await hooks['nitro:config'](nitroConfig)

  deepStrictEqual(nitroConfig.runtimeConfig.platformaticScheduler.scheduledTasks, [
    { id: '0', cron: '* * * * *', tasks: ['log'] }
  ])

  equal(nitroConfig.experimental.tasks, true)
  equal(nitroConfig.handlers.length, 1)
  equal(nitroConfig.plugins.length, 2)
  equal(nitroConfig.runtimeConfig.existing, true)
})

test('emits the manifest in the build output', async () => {
  const { hooks, nuxt } = createNuxtMock()
  schedulerModule({}, nuxt)

  await hooks['nitro:config']({ scheduledTasks: { '* * * * *': 'log' } })

  const serverDir = await mkdtemp(join(tmpdir(), 'plt-nuxt-scheduler-module-'))
  const nitroHooks = {}
  const nitro = {
    options: { output: { serverDir } },
    hooks: {
      hook (name, fn) {
        nitroHooks[name] = fn
      }
    }
  }

  await hooks['nitro:init'](nitro)
  await nitroHooks.compiled()

  const manifest = JSON.parse(await readFile(join(serverDir, SCHEDULER_MANIFEST_FILENAME), 'utf8'))
  deepStrictEqual(manifest, {
    version: 1,
    scheduledTasks: [{ id: '0', cron: '* * * * *', tasks: ['log'] }]
  })
})

test('does not emit a manifest in development', async () => {
  const { hooks, nuxt } = createNuxtMock()
  schedulerModule({}, nuxt)

  const serverDir = await mkdtemp(join(tmpdir(), 'plt-nuxt-scheduler-module-'))
  const nitroHooks = {}
  const nitro = {
    options: { dev: true, output: { serverDir } },
    hooks: {
      hook (name, fn) {
        nitroHooks[name] = fn
      }
    }
  }

  await hooks['nitro:init'](nitro)
  await nitroHooks.compiled()

  await rejects(readFile(join(serverDir, SCHEDULER_MANIFEST_FILENAME)), { code: 'ENOENT' })
})
