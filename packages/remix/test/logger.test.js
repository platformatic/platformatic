import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, getLogsFromFile } from '../../basic/test/helper.js'

test('logger options', async t => {
  const { url, root, runtime } = await createRuntime({
    t,
    root: path.resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true
  })

  await request(`${url}/`, { headers: { Authorization: 'token' } })
  await runtime.close()

  const logs = await getLogsFromFile(root)

  assert.ok(
    logs.find(log => {
      return (
        log.stdout &&
        log.stdout.name === 'remix' &&
        log.stdout.level === 'INFO' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.msg === 'Log from remix App page'
      )
    })
  )

  assert.ok(
    logs.find(log => {
      return (
        log.stdout &&
        log.stdout.name === 'remix' &&
        log.stdout.level === 'INFO' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.req?.headers?.authorization === '***HIDDEN***' &&
        log.stdout.msg === 'request completed'
      )
    })
  )
})
