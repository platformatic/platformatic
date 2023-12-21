import assert from 'node:assert'
import { once } from 'node:events'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { join } from 'desm'
import { request } from 'undici'
import { start } from './helper.mjs'

test('use runtime server', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'server', 'runtime-server', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  child.kill('SIGINT')
  await child.catch(() => {})
})

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

test('handles uncaughtException', async (t) => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'dbApp', 'platformatic.db.json')
  const { child, url } = await start('-c', config)

  t.after(async () => {
    child.kill('SIGINT')
  })
  const res = await request(url + '/async_crash')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.text(), 'ok')

  const [code] = await once(child, 'exit')
  assert.strictEqual(code, 1)
})
