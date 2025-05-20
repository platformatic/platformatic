import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { request } from 'undici'
import { readFileSync } from 'node:fs'
import { setTimeout as wait } from 'node:timers/promises'
import { fullSetupRuntime, isCIOnWindows } from '../../basic/test/helper.js'

// TODO: fix this test on windows
test('logger options', { skip: isCIOnWindows }, async t => {
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

  await request(`${url}/`)

  // wait for logger flush
  await wait(500)

  const content = readFileSync(process.env.PLT_RUNTIME_LOGGER_STDOUT, 'utf8')
  const logs = content.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line))

  assert.ok(logs.find(log => {
    return log.stdout &&
      log.stdout.name === 'vite' &&
      log.stdout.time.length === 24 && // isotime
      log.stdout.level === 'INFO' &&
      log.stdout.req?.host === '***HIDDEN***' &&
      log.stdout.msg === 'incoming request'
  }))

  assert.ok(logs.find(log => {
    return log.stdout &&
      log.stdout.name === 'vite' &&
      log.stdout.time.length === 24 && // isotime
      log.stdout.level === 'INFO' &&
      log.stdout.msg === 'Log from vite client'
  }))
})
