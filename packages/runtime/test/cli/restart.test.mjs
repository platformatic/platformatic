import { join } from 'desm'
import getPort from 'get-port'
import assert from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import { request } from 'undici'
import { start } from './helper.mjs'

async function waitForMessages (child, last) {
  const matches = {}

  const patterns = [
    ['crash', /Error: Crash/i],
    ['restartDelayed', /The service \\"a\\" will be restarted in 1000ms .../i],
    ['restartImmediate', /The service \\"a\\" is being restarted .../i],
    ['unavailable', /The service \\"a\\" is no longer available./i],
    ['listening', /listening/i]
  ]

  child.stdout.setEncoding('utf8')

  for await (const messages of on(child.stdout, 'data')) {
    for (const message of messages) {
      for (const [label, pattern] of patterns) {
        if (pattern.test(message)) {
          matches[label] = true
        }
      }
    }

    if (matches[last]) {
      break
    }
  }

  return matches
}

test('restart in case of a crash with a delay in development', async () => {
  process.env.PORT = await getPort()
  const config = join(import.meta.url, '..', '..', 'fixtures', 'restart-on-crash', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)

  {
    const res = await request(url + '/crash', {
      method: 'POST'
    })

    assert.strictEqual(res.statusCode, 200)
  }

  const matches = await waitForMessages(child, 'listening')

  assert.ok(matches.crash)
  assert.ok(matches.restartDelayed)
  assert.ok(!matches.restartImmediate)
  assert.ok(!matches.unavailable)
  assert.ok(matches.listening)

  {
    const res = await request(url + '/')
    assert.strictEqual(res.statusCode, 200)
  }

  child.kill('SIGINT')
  await child.catch(() => {})
})

test('restart in case of a crash without any delay in production', async () => {
  process.env.PORT = await getPort()
  const config = join(import.meta.url, '..', '..', 'fixtures', 'restart-on-crash', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config, '--production')

  {
    const res = await request(url + '/crash', {
      method: 'POST'
    })

    assert.strictEqual(res.statusCode, 200)
  }

  const matches = await waitForMessages(child, 'listening')

  assert.ok(matches.crash)
  assert.ok(!matches.restartDelayed)
  assert.ok(matches.restartImmediate)
  assert.ok(!matches.unavailable)
  assert.ok(matches.listening)

  {
    const res = await request(url + '/')
    assert.strictEqual(res.statusCode, 200)
  }

  child.kill('SIGINT')
  await child.catch(() => {})
})

test("do not restart in case of a crash in case it's so specified in development", async () => {
  process.env.PORT = await getPort()
  const config = join(import.meta.url, '..', '..', 'fixtures', 'do-not-restart-on-crash', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)

  {
    const res = await request(url + '/crash', {
      method: 'POST'
    })

    assert.strictEqual(res.statusCode, 200)
  }

  const matches = await waitForMessages(child, 'unavailable')

  assert.ok(matches.crash)
  assert.ok(!matches.restartDelayed)
  assert.ok(!matches.restartImmediate)
  assert.ok(matches.unavailable)
  assert.ok(!matches.listening)

  child.kill('SIGINT')
  await child.catch(() => {})
})

test('should restart in production even if restartOnError is false', async () => {
  process.env.PORT = await getPort()
  const config = join(import.meta.url, '..', '..', 'fixtures', 'do-not-restart-on-crash', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config, '--production')

  {
    const res = await request(url + '/crash', {
      method: 'POST'
    })

    assert.strictEqual(res.statusCode, 200)
  }

  const matches = await waitForMessages(child, 'listening')

  assert.ok(matches.crash)
  assert.ok(!matches.restartDelayed)
  assert.ok(matches.restartImmediate)
  assert.ok(!matches.unavailable)
  assert.ok(matches.listening)

  {
    const res = await request(url + '/')
    assert.strictEqual(res.statusCode, 200)
  }

  child.kill('SIGINT')
  await child.catch(() => {})
})
