import { swapVersion } from '@platformatic/basic/test/helper-version.js'
import { safeRemove } from '@platformatic/utils'
import { ok, rejects } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { getLogsFromFile, prepareRuntime, setFixturesDir, setLogFile } from '../../basic/test/helper.js'
import { buildServer } from '../../runtime/index.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('Astro version is checked in development', async t => {
  const { root, config } = await prepareRuntime(t, 'standalone', false, null, async root => {
    await swapVersion(t, import.meta.dirname, 'astro', '../..')
    await setLogFile(t, root)
  })

  process.chdir(root)
  const runtime = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await runtime.close()
    await safeRemove(root)
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(logs.some(l => l.msg.includes('astro version 1.0.0 is not supported')))
})

test('Astro version is not checked in production', async t => {
  const { root, config } = await prepareRuntime(t, 'standalone', true, null, async root => {
    await swapVersion(t, import.meta.dirname, 'astro', '../..')

    await setLogFile(t, root)
  })

  process.chdir(root)
  const runtime = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await runtime.close()
    await safeRemove(root)
  })

  await rejects(runtime.start())
  const logs = await getLogsFromFile(root)

  ok(!logs.some(l => l.msg.includes('astro version 1.0.0 is not supported')))
})
