import { deepStrictEqual } from 'node:assert'
import { createDirectory } from '@platformatic/foundation'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { create } from '../../index.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

export const tempPath = resolve(import.meta.dirname, '../../../../tmp/')

async function createRuntime (configOrRoot, sourceOrConfig, context) {
  await createDirectory(tempPath)

  context ??= {}
  context.logsPath ??= resolve(tempPath, `log-${Date.now()}.txt`)

  return create(configOrRoot, sourceOrConfig,
    context,
    // The differece with ../helpers.js is that we do not set up global signal handlers
    false)
}

test('do not install additional process signals if requested', async t => {
  const configFile = join(fixturesDir, 'configs', 'no-entrypoint-single-service.json')
  const listenersBefore = process.listenerCount('SIGINT')
  const app = await createRuntime(configFile)
  await app.init()

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const listenersAfter = process.listenerCount('SIGINT')

  deepStrictEqual(listenersAfter, listenersBefore)
})
