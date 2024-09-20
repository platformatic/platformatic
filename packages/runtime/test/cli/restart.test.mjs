import { join } from 'desm'
import getPort from 'get-port'
import assert from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import { request } from 'undici'
import { start } from './helper.mjs'

test('restart in case of a crash', async () => {
  process.env.PORT = await getPort()
  const config = join(import.meta.url, '..', '..', 'fixtures', 'restart-on-crash', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)

  {
    const res = await request(url + '/crash', {
      method: 'POST'
    })

    assert.strictEqual(res.statusCode, 200)
  }

  let found = false
  let foundListening = false
  child.stdout.setEncoding('utf8')
  for await (const messages of on(child.stdout, 'data')) {
    for (const message of messages) {
      if (/Error: Crash/.test(message)) {
        found = true
      }

      if (/listening/i.test(message)) {
        foundListening = true
      }
    }

    if (foundListening) {
      break
    }
  }

  assert.ok(found)
  assert.ok(foundListening)

  {
    const res = await request(url + '/')
    assert.strictEqual(res.statusCode, 200)
  }

  child.kill('SIGINT')
  await child.catch(() => {})
})

test("do not restart in case of a crash in case it's so specified", async () => {
  process.env.PORT = await getPort()
  const config = join(import.meta.url, '..', '..', 'fixtures', 'do-not-restart-on-crash', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)

  request(url + '/crash', {
    method: 'POST'
  })

  let found = false
  let foundUnavailable = false
  child.stdout.setEncoding('utf8')
  for await (const messages of on(child.stdout, 'data')) {
    for (const message of messages) {
      if (/Error: Crash/.test(message)) {
        found = true
      }

      if (/The \\"a\\" service is no longer available./i.test(message)) {
        foundUnavailable = true
      }
    }

    if (foundUnavailable) {
      break
    }
  }

  assert.ok(found)
  assert.ok(foundUnavailable)

  child.kill('SIGINT')
  await child.catch(() => {})
})
