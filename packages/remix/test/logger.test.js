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

  {
    const frontendLog = logs.find(log => log.name === 'frontend' && log.msg.includes('Log from remix App page'))
    const log = JSON.parse(frontendLog.msg)
    assert.equal(log.name, 'remix')
    assert.equal(log.time.length, 24) // isotime
    assert.equal(log.level, 'INFO')
    assert.equal(log.msg, 'Log from remix App page')
  }

  { const frontendLog = logs.find(log => log.name === 'frontend' && log.msg.includes('request completed'))
    const log = JSON.parse(frontendLog.msg)
    assert.equal(log.name, 'remix')
    assert.equal(log.time.length, 24) // isotime
    assert.equal(log.level, 'INFO')
    assert.equal(log.req.headers.authorization, '***HIDDEN***')
    assert.equal(log.msg, 'request completed')
  }
})
