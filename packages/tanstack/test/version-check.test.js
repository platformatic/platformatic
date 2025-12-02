import { ok, rejects } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { swapVersion } from '../../basic/test/helper-version.js'
import { getLogsFromFile, prepareRuntime, setFixturesDir } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('TanStack version is checked in development', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone', false, null, async () => {
    await swapVersion(t, import.meta.dirname, '@tanstack/react-start', '../..', '0.1.0')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(logs.some(l => l.err?.message.includes('@tanstack/react-start version 0.1.0 is not supported')))
})

test('TanStack version is not checked in production', async t => {
  const { runtime, root } = await prepareRuntime(t, 'standalone', true, null, async () => {
    await swapVersion(t, import.meta.dirname, '@tanstack/react-start', '../..', '0.1.0')
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(!logs.some(l => l.err?.message.includes('@tanstack/react-start version 0.1.0 is not supported')))
})
