import { strict as assert } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, getLogsFromFile, isCIOnWindows } from '../../basic/test/helper.js'
import { copyServerEntrypoint } from './helper.js'

// TODO: fix this test on windows
test('logger options', { skip: isCIOnWindows }, async t => {
  const { runtime, root, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true,
    additionalSetup: copyServerEntrypoint
  })

  await request(`${url}/`)
  await runtime.close()

  const logs = await getLogsFromFile(root)

  assert.ok(
    logs.find(log => {
      return (
        log.stdout &&
        log.stdout.name === 'vite' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.level === 'INFO' &&
        log.stdout.req?.host === '***HIDDEN***' &&
        log.stdout.msg === 'incoming request'
      )
    })
  )

  assert.ok(
    logs.find(log => {
      return (
        log.stdout &&
        log.stdout.name === 'vite' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.level === 'INFO' &&
        log.stdout.msg === 'Log from vite client'
      )
    })
  )
})
