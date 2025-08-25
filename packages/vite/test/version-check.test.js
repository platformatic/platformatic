import { safeRemove } from '@platformatic/utils'
import { ok, rejects } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { getLogs, setLogFile, swapVersion } from '../../basic/test/helper-version.js'
import { prepareRuntime, setFixturesDir } from '../../basic/test/helper.js'
import { buildServer } from '../../runtime/index.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('Vite version is checked in development', async t => {
  const { root, config } = await prepareRuntime(t, 'standalone', false, null, async root => {
    await swapVersion(t, import.meta.dirname, 'vite')
    await setLogFile(t, root)
  })

  process.chdir(root)
  const runtime = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await runtime.close()
    await safeRemove(root)
  })

  await rejects(runtime.start())
  const logs = await getLogs(root)

  ok(logs.some(l => l.msg.includes('vite version 1.0.0 is not supported')))
})

test('Vite version is not checked in production', async t => {
  const { root, config } = await prepareRuntime(t, 'standalone', true, null, async root => {
    await swapVersion(t, import.meta.dirname, 'vite')
    await setLogFile(t, root)
  })

  process.chdir(root)
  const runtime = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    await runtime.close()
    await safeRemove(root)
  })

  await rejects(runtime.start())
  const logs = await getLogs(root)

  ok(!logs.some(l => l.msg.includes('vite version 1.0.0 is not supported')))
})
