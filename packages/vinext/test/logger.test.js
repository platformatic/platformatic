import { strict as assert } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, getLogsFromFile } from '../../basic/test/helper.js'

test('logger options', async t => {
  const { runtime, root, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true
  })

  await request(`${url}/`)
  await runtime.close()

  const logs = await getLogsFromFile(root)

  assert.ok(
    logs.find(log => {
      return (
        log.stdout &&
        log.stdout.name === 'frontend' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.level === 'INFO' &&
        log.stdout.msg === 'Log from vinext client'
      )
    })
  )
})
