import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, getLogs } from '../../basic/test/helper.js'

test('logger options', async t => {
  const { url, runtime } = await createRuntime({
    t,
    root: path.resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true
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
