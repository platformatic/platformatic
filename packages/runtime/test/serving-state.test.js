import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('an application that serves no HTTP reports it, and every worker agrees', async t => {
  const app = await createRuntime(join(fixturesDir, 'serving-state', 'configs', 'background', 'watt.config.mjs'))

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const details = await app.getApplicationDetails('background')
  strictEqual(details.status, 'started')
  strictEqual(details.servingState, 'background')
})

test('a stopped application makes no claim about how it would serve', async t => {
  const app = await createRuntime(join(fixturesDir, 'serving-state', 'configs', 'background', 'watt.config.mjs'))

  t.after(async () => {
    await app.close()
  })

  await app.start()
  await app.stopApplication('background')

  const details = await app.getApplicationDetails('background', true)
  deepStrictEqual(details.servingState, undefined)
})

test('workers that disagree about how the application serves are refused', async t => {
  const app = await createRuntime(join(fixturesDir, 'serving-state', 'configs', 'disagreeing', 'watt.config.mjs'))

  t.after(async () => {
    await app.close()
  })

  /*
    Failing loudly beats destroying a fraction of mesh requests: with one worker listening and one
    serving nothing, dispatch would route a share of requests to the worker that answers nothing.
  */
  await rejects(
    () => app.start(),
    error => {
      strictEqual(error.code, 'PLT_RUNTIME_MIXED_SERVING_STATE')
      return true
    }
  )
})
