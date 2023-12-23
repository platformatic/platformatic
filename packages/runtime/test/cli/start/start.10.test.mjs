import assert from 'node:assert'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { join } from 'desm'
import { request } from 'undici'
import { start } from '../helper.mjs'

test('start command with js file', async (t) => {
  const file = join(import.meta.url, '..', '..', '..', 'fixtures', 'empty', 'hello.js')
  const config = join(import.meta.url, '..', '..', '..', 'fixtures', 'empty', 'platformatic.service.json')
  try {
    await fs.unlink(config)
  } catch {}

  t.after(async () => {
    await fs.unlink(config)
  })

  const { child, url } = await start(file)
  const res = await request(url + '/hello')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  child.kill('SIGKILL')
  await child.catch(() => {})
})
