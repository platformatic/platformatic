import { strictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, createTemporaryDirectory } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('emits the exit event before a worker exits', async t => {
  const directory = await createTemporaryDirectory(t, 'exit-event')
  const exitEventFile = join(directory, 'exit-event')
  const originalExitEventFile = process.env.PLT_EXIT_EVENT_FILE
  process.env.PLT_EXIT_EVENT_FILE = exitEventFile

  t.after(() => {
    if (originalExitEventFile === undefined) {
      delete process.env.PLT_EXIT_EVENT_FILE
    } else {
      process.env.PLT_EXIT_EVENT_FILE = originalExitEventFile
    }
  })

  const configFile = join(fixturesDir, 'exit-event', 'platformatic.json')
  const runtime = await createRuntime(configFile)
  t.after(() => runtime.close())

  await runtime.start()
  await runtime.close()

  strictEqual(await readFile(exitEventFile, 'utf8'), 'exit')
})
