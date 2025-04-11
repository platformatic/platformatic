import { resolve } from 'node:path'
import { test } from 'node:test'
import { getLogs, prepareRuntime, setFixturesDir } from '../../basic/test/helper.js'
import { safeRemove } from '@platformatic/utils'
import { buildServer } from '../../runtime/index.js'
import { request } from 'undici'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should run the service with custom logger options', async t => {
  const { root, config } = await prepareRuntime(t, 'logger-custom-options-json', false, null)

  const originalCwd = process.cwd()
  process.chdir(root)
  const runtime = await buildServer(config.configManager.current, config.args)

  t.after(async () => {
    process.chdir(originalCwd)
    await runtime.close()
    await safeRemove(root)
  })

  await runtime.buildService('app')
  const url = await runtime.start()

  console.log(url)

  const response = await request(url, {    path: '/'  })

  const logs = await getLogs(runtime)

  console.log(logs)

  // deepEqual(logs[1].msg, 'INJECTED true')
})

// error loading paths
// error validation timestamp, option types