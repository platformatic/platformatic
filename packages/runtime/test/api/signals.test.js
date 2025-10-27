import { deepStrictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('do not install additional process signals if requested', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-single-service.json')
  const listenersBefore = process.listenerCount('SIGINT')
  const app = await createRuntime(configFile, undefined, {
    setUpSignals: false
  })
  await app.init()

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const listenersAfter = process.listenerCount('SIGINT')

  deepStrictEqual(listenersAfter, listenersBefore)
})
