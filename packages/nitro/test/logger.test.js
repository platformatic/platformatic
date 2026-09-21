import { ok, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, getLogsFromFile, setAdditionalDependencies } from '../../basic/test/helper.js'

setAdditionalDependencies(['nitropack'])

test('forwards Nitro application output to the configured logger', async t => {
  const { url, root, runtime } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/standalone-nitro'),
    production: false
  })

  const response = await request(`${url}/`)
  strictEqual(response.statusCode, 200)
  await runtime.close()

  const logs = await getLogsFromFile(root)
  ok(logs.some(log => log.caller === 'STDOUT' && log.msg === 'Log from Nitro route'))
})
