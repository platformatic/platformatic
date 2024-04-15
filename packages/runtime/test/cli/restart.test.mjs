import assert from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import getPort from 'get-port'
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

  let stdout = ''
  let found = false
  let foundListening = false
  child.stdout.setEncoding('utf8')
  for await (const messages of on(child.stdout, 'data')) {
    for (const message of messages) {
      stdout += message

      if (/Error: Crash/.test(stdout)) {
        found = true
      }

      if (/listening/i.test(stdout)) {
        foundListening = true
      }
    }

    if (foundListening) {
      break
    }
  }

  assert.ok(found)

  {
    const res = await request(url + '/')
    assert.strictEqual(res.statusCode, 200)
  }

  child.kill('SIGINT')
  await child.catch(() => {})
})
