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
  console.log('-------------start-cli 3.1 started')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'stackables', 'platformatic.json')
  console.log('-------------start-cli 3.1.1')
  const { child, url } = await start('-c', config)
  console.log('-------------start-cli 3.1.2')
  const res = await request(url + '/foo')

  console.log('-------------start-cli 3.1.3')

  assert.strictEqual(res.statusCode, 200)
  console.log('-------------start-cli 3.1.4')

  assert.deepStrictEqual(await res.body.text(), 'Hello World')
  console.log('-------------start-cli 3.1.5')

  child.kill('SIGINT')
  console.log('-------------start-cli 3.1.6')

  await child.catch((error) => {
    console.log('start 3.1 error', error)
  })
  console.log('-------------start-cli 3.1 finished')
})

test('use runtime server', async () => {
  console.log('-------------start-cli 3.2 started')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'server', 'runtime-server', 'platformatic.runtime.json')
  console.log('-------------start-cli 3.2.1')
  const { child, url } = await start('-c', config)
  console.log('-------------start-cli 3.2.2')
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  console.log('-------------start-cli 3.2.3')

  child.kill('SIGINT')
  console.log('-------------start-cli 3.2.4')

  await child.catch((error) => {
    console.log('error2', error)
  })
  console.log('-------------start-cli 3.2 finished')
})
