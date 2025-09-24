import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { getLogsFromFile, prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('correctly invokes onClose hooks', async t => {
  const { root, runtime } = await prepareRuntime(t, 'fastify-with-build-standalone', false, undefined, (
    root,
    config
  ) => {
    config.logger.level = 'trace'
    return config
  })
  const url = await startRuntime(t, runtime)

  const res = await fetch(url)

  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { production: false })

  await runtime.close()

  const logs = await getLogsFromFile(root)
  ok(logs.find(m => m.event === 'application:worker:event:fastify:close'))
  ok(!logs.find(m => m.event === 'application:worker:exit:timeout'))
})
