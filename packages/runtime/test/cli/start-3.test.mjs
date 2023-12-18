import assert from 'node:assert'
import { test, beforeEach, afterEach } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { start } from './helper.mjs'

beforeEach(async (t) => {
  console.log('starting cli test')
})

afterEach(async (t) => {
  console.log('ending cli test')
})

test('stackable', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'stackables', 'platformatic.json')
  const { child, url } = await start('-c', config)
  const res = await request(url + '/foo')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.text(), 'Hello World')
  child.kill('SIGINT')
  await child.catch(() => {})
})

test('use runtime server', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'server', 'runtime-server', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  child.kill('SIGINT')
  await child.catch(() => {})
})
