import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { start } from './helper.mjs'

import why from 'why-is-node-running'
setTimeout(() => {
  console.log('-----------------watch-2 - start')
  why()
  console.log('-----------------watch-2 - end')
}, 40000).unref()

test('stackable', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'stackables', 'platformatic.json')
  const { child, url } = await start('-c', config)
  const res = await request(url + '/foo')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.text(), 'Hello World')
  child.kill('SIGINT')
  await child.catch((error) => {
    console.log('error1', error)
  })
})

test('use runtime server', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'server', 'runtime-server', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  child.kill('SIGINT')
  await child.catch((error) => {
    console.log('error2', error)
  })
})
