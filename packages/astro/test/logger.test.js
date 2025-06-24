import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { setTimeout as wait } from 'node:timers/promises'
import { request } from 'undici'
import { fullSetupRuntime } from '../../basic/test/helper.js'

test('logger options', async t => {
  const { url } = await fullSetupRuntime({
    t,
    configRoot: path.resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true
  })

  await request(`${url}/`)

  // wait for logger flush
  await wait(500)

  const content = readFileSync(process.env.PLT_RUNTIME_LOGGER_STDOUT, 'utf8')

  const logs = content
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line))

  assert.ok(
    logs.find(log => {
      return (
        log?.name === 'frontend' &&
        log?.stdout?.level === 'INFO' &&
        log?.stdout?.name === 'astro' &&
        log?.stdout?.time?.length === 24 && // isotime
        log?.stdout?.req?.host === '***HIDDEN***' &&
        log?.stdout?.msg === 'incoming request'
      )
    })
  )
})
