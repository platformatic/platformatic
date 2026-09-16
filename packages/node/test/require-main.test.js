import { deepStrictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  createRuntime,
  setFixturesDir,
  verifyJSONViaHTTP
} from '../../basic/test/helper.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should set require.main to the application entrypoint', async t => {
  const { runtime, url } = await createRuntime(t, 'require-main')

  await verifyJSONViaHTTP(url, '/', 200, { isMain: true })

  deepStrictEqual(await runtime.close(), undefined)
})

test('should not set import.meta.main for an ESM application entrypoint', async t => {
  const { runtime, url } = await createRuntime(t, 'require-main', false, false, 'platformatic.runtime.json', async root => {
    await updateConfigFile(resolve(root, 'services/frontend/package.json'), config => {
      config.type = 'module'
    })
    await updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), config => {
      config.node = { main: 'index.js' }
    })
  })

  await verifyJSONViaHTTP(url, '/', 200, { isMain: false })

  deepStrictEqual(await runtime.close(), undefined)
})
