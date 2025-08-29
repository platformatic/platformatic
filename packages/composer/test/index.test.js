import { ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createRuntime, getLogsFromFile, setFixturesDir, verifyJSONViaHTTP } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should start an application and show a warning', async t => {
  const { root, url, runtime } = await createRuntime(t, 'main')

  await verifyJSONViaHTTP(url, '/service/check', 200, { ok: true })

  await runtime.close()
  const logs = await getLogsFromFile(root)

  ok(
    logs.find(
      m =>
        m.level === 40 &&
        m.msg ===
          '@platformatic/composer is deprecated and it will be removed in version 4.0.0, please migrate to @platformatic/gateway.'
    )
  )
})
