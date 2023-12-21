import assert from 'node:assert'
import { mkdir, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { on } from 'node:events'
import desm from 'desm'
import { request } from 'undici'
import { start } from '../helper.mjs'

const fixturesDir = join(desm(import.meta.url), '..', '..', '..', 'fixtures')

const base = join(desm(import.meta.url), '..', '..', 'tmp')

try {
  await mkdir(base, { recursive: true })
} catch {
}

test('do not hot reload dependencies', async (t) => {
  process.env.PORT = 0
  const config = join(fixturesDir, 'do-not-reload-dependencies', 'platformatic.service.json')
  const { child, url } = await start('-c', config)
  t.after(() => child.kill('SIGINT'))
  t.after(() => delete process.env.PORT)

  const res1 = await request(`${url}/plugin1`)
  const plugin1 = (await res1.body.json()).hello

  const res2 = await request(`${url}/plugin2`)
  const plugin2 = (await res2.body.json()).hello

  utimes(config, new Date(), new Date()).catch(() => {})

  // wait for restart
  for await (const messages of on(child.ndj, 'data')) {
    let url
    for (const message of messages) {
      if (message.msg) {
        url = message.msg.match(/server listening at (.+)/i)?.[1]

        if (url !== undefined) {
          break
        }
      }
    }

    if (url !== undefined) {
      break
    }
  }

  const res3 = await request(`${url}/plugin1`)
  assert.strictEqual((await res3.body.json()).hello, plugin1)

  const res4 = await request(`${url}/plugin2`)
  assert.strictEqual((await res4.body.json()).hello, plugin2)
})
