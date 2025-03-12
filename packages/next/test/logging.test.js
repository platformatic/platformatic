import { deepStrictEqual, ok } from 'node:assert'
import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import {
  commonFixturesRoot,
  ensureDependencies,
  getLogs,
  prepareRuntime,
  setFixturesDir,
  startRuntime,
  updateFile
} from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('can properly show the logs the output', async t => {
  const { root, config } = await prepareRuntime(t, 'composer-with-prefix', true, null, async root => {
    await updateFile(resolve(root, 'platformatic.runtime.json'), contents => {
      const json = JSON.parse(contents)
      json.workers = 3
      return JSON.stringify(json, null, 2)
    })

    await cp(resolve(commonFixturesRoot, 'composer-js'), resolve(root, 'services/composer'), { recursive: true })
    await cp(resolve(commonFixturesRoot, 'backend-js'), resolve(root, 'services/backend'), { recursive: true })
    await ensureDependencies([resolve(root, 'services/composer'), resolve(root, 'services/backend')])

    await updateFile(resolve(root, 'services/composer/routes/root.js'), contents => {
      return contents.replace('$PREFIX', '/frontend')
    })
  })

  const { runtime, url } = await startRuntime(t, root, config, null, ['frontend'])

  {
    const { statusCode } = await request(url + '/frontend')
    deepStrictEqual(statusCode, 200)
  }

  {
    const logs = await getLogs(runtime)

    // Each log has either the worker number, comes from the main thread or
    // it is the composer, which is the entrypoint and thus no worker
    ok(logs.every(l => !l.base && (typeof l.worker === 'number' || !l.name || l.name === 'composer')))
  }
})
