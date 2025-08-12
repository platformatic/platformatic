import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as wait } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime, isCIOnWindows } from '../../basic/test/helper.js'

// TODO: fix this test on windows
test('logger options', { skip: isCIOnWindows }, async t => {
  const { root, url } = await createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true
  })

  await request(`${url}/`)

  // wait for logger flush
  await wait(500)

  const content = readFileSync(resolve(root, 'logs.txt'), 'utf8')
  const logs = content
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line))

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
