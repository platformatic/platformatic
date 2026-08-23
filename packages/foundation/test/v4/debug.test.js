import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { evaluateConfigurationFile, evaluateConfigurationInProcess } from '../../lib/v4/index.js'
import { createTree } from './helper.js'

test('the in-process mode produces what a worker produces', async t => {
  const root = await createTree(t, {
    'watt.config.js':
      'export default ctx => ({ applications: [{ id: "api", path: "." }], mode: ctx.mode, from: process.env.WHO })'
  })

  const options = {
    path: join(root, 'watt.config.js'),
    directory: root,
    command: 'start',
    mode: 'production',
    production: true,
    env: { WHO: 'resolved-view' }
  }

  const inProcess = await evaluateConfigurationInProcess(options)
  const inWorker = await evaluateConfigurationFile(options)

  // One implementation, because the printed configuration has to equal a real boot's.
  deepStrictEqual(inProcess.config, inWorker.config)
  strictEqual(inProcess.config.from, 'resolved-view')
})

test('the in-process mode restores the environment it borrowed', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'process.env.WRITTEN = "yes"\nexport default { applications: [] }'
  })

  process.env.PLT_DEBUG_SENTINEL = 'untouched'
  t.after(() => {
    delete process.env.PLT_DEBUG_SENTINEL
  })

  const { mutatedEnvKeys } = await evaluateConfigurationInProcess({
    path: join(root, 'watt.config.js'),
    directory: root,
    command: 'start',
    production: true,
    env: { WHO: 'view' }
  })

  // Otherwise the "does not propagate" statement would be false in debug mode.
  deepStrictEqual(mutatedEnvKeys, ['WRITTEN'])
  strictEqual(process.env.PLT_DEBUG_SENTINEL, 'untouched')
  strictEqual(process.env.WHO, undefined)
  strictEqual(process.env.WRITTEN, undefined)
})

test('the in-process mode restores the environment after a failure too', async t => {
  const root = await createTree(t, { 'watt.config.js': 'throw new Error("broken")' })

  process.env.PLT_DEBUG_SENTINEL = 'untouched'
  t.after(() => {
    delete process.env.PLT_DEBUG_SENTINEL
  })

  await rejects(() =>
    evaluateConfigurationInProcess({
      path: join(root, 'watt.config.js'),
      directory: root,
      command: 'start',
      env: { WHO: 'view' }
    })
  )

  strictEqual(process.env.PLT_DEBUG_SENTINEL, 'untouched')
  strictEqual(process.env.WHO, undefined)
})

test('the in-process mode applies no deadline', async t => {
  // A paused breakpoint session must not be killed by the 30 s timer, so the option is not even
  // accepted here — the caller cannot ask for one by accident.
  const root = await createTree(t, {
    'watt.config.js':
      'export default async () => { await new Promise(resolve => setTimeout(resolve, 50)); return { applications: [] } }'
  })

  const { config } = await evaluateConfigurationInProcess({
    path: join(root, 'watt.config.js'),
    directory: root,
    command: 'start',
    timeout: 1,
    env: {}
  })

  ok(Array.isArray(config.applications))
})
