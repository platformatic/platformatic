import { strict as assert } from 'node:assert'
import path, { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { fullSetupRuntime, getLogs } from '../../basic/test/helper.js'

test('logger options', async t => {
  const { url, runtime } = await fullSetupRuntime({
    t,
    configRoot: path.resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true,
    additionalSetup (root) {
      const originalEnv = process.env.PLT_RUNTIME_LOGGER_STDOUT
      process.env.PLT_RUNTIME_LOGGER_STDOUT = resolve(root, 'log.txt')

      t.after(() => {
        process.env.PLT_RUNTIME_LOGGER_STDOUT = originalEnv
      })
    }
  })

  await request(`${url}/`, { headers: { Authorization: 'token' } })

  const logs = await getLogs(runtime)

  assert.ok(
    logs.find(log => {
      return (
        log.stdout &&
        log.stdout.name === 'nest' &&
        log.stdout.level === 'INFO' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.msg === 'Log from Nest App page'
      )
    })
  )

  assert.ok(
    logs.find(log => {
      return (
        log.stdout &&
        log.stdout.name === 'nest' &&
        log.stdout.level === 'INFO' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.req?.headers?.authorization === '***HIDDEN***' &&
        log.stdout.msg === 'request completed'
      )
    })
  )
})
