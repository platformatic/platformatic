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
  console.log('-------------start-cli 3.2 started')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'server', 'overrides-service', 'platformatic.runtime.json')
  console.log('-------------start-cli 3.2.1')
  const { child, url } = await start('-c', config)
  console.log('-------------start-cli 3.2.2')
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  console.log('-------------start-cli 3.2.3')
  child.kill('SIGINT')
  console.log('-------------start-cli 3.2 finished')
})

test('start command with js file', async (t) => {
  console.log('-------------start-cli 3.3 started')
  const file = join(import.meta.url, '..', '..', 'fixtures', 'empty', 'hello.js')
  console.log('-------------start-cli 3.3.1')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'empty', 'platformatic.service.json')
  console.log('-------------start-cli 3.3.2')
  try {
    console.log('-------------start-cli 3.3.3')
    await fs.unlink(config)
    console.log('-------------start-cli 3.3.4')
  } catch {}

  console.log('-------------start-cli 3.3.5')
  t.after(async () => {
    console.log('-------------start-cli 3.3.6')
    await fs.unlink(config)
    console.log('-------------start-cli 3.3.7')
  })
  console.log('-------------start-cli 3.3.8')

  const { child, url } = await start(file)

  console.log('-------------start-cli 3.3.9')
  const res = await request(url + '/hello')

  console.log('-------------start-cli 3.3.10')

  assert.strictEqual(res.statusCode, 200)
  console.log('-------------start-cli 3.3.11')
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  console.log('-------------start-cli 3.3.12')
  child.kill('SIGINT')
  console.log('-------------start-cli 3.3.13')
  await child.catch(() => {})
  console.log('-------------start-cli 3.3 finished')
})
