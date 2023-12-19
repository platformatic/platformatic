import assert from 'node:assert'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { join } from 'desm'
import { request } from 'undici'
import { start } from './helper.mjs'

import why from 'why-is-node-running'
setTimeout(() => {
  console.log('-----------------watch-2 - start')
  why()
  console.log('-----------------watch-2 - end')
}, 40000).unref()

test('the runtime server overrides the entrypoint server', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'server', 'overrides-service', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  child.kill('SIGINT')
})

test('start command with js file', async (t) => {
  const file = join(import.meta.url, '..', '..', 'fixtures', 'empty', 'hello.js')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'empty', 'platformatic.service.json')
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
  child.kill('SIGINT')
  await child.catch(() => {})
})
