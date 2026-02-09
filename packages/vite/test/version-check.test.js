import { ok, rejects } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { swapVersion } from '../../basic/test/helper-version.js'
import { getLogsFromFile, prepareRuntime, setFixturesDir } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('Vite version is checked in development', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone', false, null, async root => {
    await swapVersion(t, root, 'vite', '../..')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(logs.some(l => l.err?.message.includes('vite version 1.0.0 is not supported')))
})

test('Vite version is not checked in production', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone', true, null, async root => {
    await swapVersion(t, root, 'vite', '../..')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(!logs.some(l => l.err?.message.includes('vite version 1.0.0 is not supported')))
})
