import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { request } from 'undici'
import { readFileSync } from 'node:fs'
import { setTimeout as wait } from 'node:timers/promises'
import { fullSetupRuntime } from '../../basic/test/helper.js'

test('logger options', async t => {
  const originalRuntimeLoggerOut = process.env.PLT_RUNTIME_LOGGER_STDOUT
  process.env.PLT_RUNTIME_LOGGER_STDOUT = path.join(tmpdir(), `test-logs-vite-${Date.now().toString()}`)
  t.after(() => {
    process.env.PLT_RUNTIME_LOGGER_STDOUT = originalRuntimeLoggerOut
  })

  const { url } = await fullSetupRuntime({
    t,
    configRoot: path.resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true,
  })

  const response = await request(`${url}/`)
  console.log(response.statusCode)
  console.log(await response.body.text())

  // wait for logger flush
  await wait(500)

  const content = readFileSync(process.env.PLT_RUNTIME_LOGGER_STDOUT, 'utf8')
  const logs = content.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line))

  { const log = logs.find(log => log.name === 'frontend' && log.msg.includes('incoming request'))
    const logContent = JSON.parse(log.msg)
    assert.equal(logContent.name, 'vite')
    assert.equal(logContent.time.length, 24) // isotime
    assert.equal(logContent.level, 'INFO')
    assert.equal(logContent.req.host, '***HIDDEN***')
    assert.equal(logContent.msg, 'incoming request')
  }

  { const log = logs.find(log => log.name === 'frontend' && log.msg.includes('Log from vite client'))
    const logContent = JSON.parse(log.msg)
    assert.equal(logContent.name, 'vite')
    assert.equal(logContent.time.length, 24) // isotime
    assert.equal(logContent.level, 'INFO')
    assert.equal(logContent.msg, 'Log from vite client')
  }
})
