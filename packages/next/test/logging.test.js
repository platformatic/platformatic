import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import {
  copyCommonApplication,
  ensureDependencies,
  getLogsFromFile,
  prepareRuntime,
  setFixturesDir,
  startRuntime,
  updateFile
} from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('can properly show the logs the output', async t => {
  const { root, runtime } = await prepareRuntime({
    t,
    root: resolve(import.meta.dirname, 'fixtures/composer-with-prefix'),
    production: true,
    port: 0,
    additionalSetup: async root => {
      await updateFile(resolve(root, 'platformatic.runtime.json'), contents => {
        const json = JSON.parse(contents)
        json.workers = 3
        return JSON.stringify(json, null, 2)
      })

      await copyCommonApplication(root, 'composer')
      await copyCommonApplication(root, 'backend')
      await ensureDependencies([resolve(root, 'services/composer'), resolve(root, 'services/backend')])

      await updateFile(resolve(root, 'services/composer/routes/root.js'), contents => {
        return contents.replace('$PREFIX', '/frontend')
      })
    }
  })

  const url = await startRuntime(t, runtime, null, ['frontend'])

  {
    const { statusCode } = await request(url + '/frontend')
    deepStrictEqual(statusCode, 200)
  }

  {
    await runtime.close()
    const logs = await getLogsFromFile(root)

    // Each log has either the worker number, comes from the main thread or
    // it is the composer, which is the entrypoint and thus no worker
    ok(logs.every(l => !l.base && (typeof l.worker === 'number' || !l.name || l.name === 'composer')))
  }
})
