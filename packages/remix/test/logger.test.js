import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { fullSetupRuntime, getLogs } from '../../basic/test/helper.js'

test('logger options', async t => {
  process.env.PLT_RUNTIME_LOGGER_STDOUT = 1

  const { url, runtime } = await fullSetupRuntime({
    t,
    configRoot: path.resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true,
  })

  await request(`${url}/`, { headers: { Authorization: 'token' } })

  const logs = await getLogs(runtime)
  const frontendLogs = logs.filter(log => log.name === 'frontend')

  assert.equal(frontendLogs.length, 2)
  const frontendLog = JSON.parse(frontendLogs[1].msg)

  assert.equal(frontendLog.name, 'remix')
  assert.equal(frontendLog.time.length, 24) // isotime
  assert.equal(frontendLog.level, 'INFO')
  assert.equal(frontendLog.req.headers.authorization, '***HIDDEN***')
  assert.equal(frontendLog.msg, 'request completed')
})
