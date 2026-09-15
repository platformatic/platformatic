import { deepStrictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  createRuntime,
  setFixturesDir,
  verifyJSONViaHTTP
} from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should set require.main to the application entrypoint', async t => {
  const { runtime, url } = await createRuntime(t, 'require-main')

  await verifyJSONViaHTTP(url, '/', 200, { isMain: true })

  deepStrictEqual(await runtime.close(), undefined)
})
