import { join } from 'desm'
import assert from 'node:assert'
import { test } from 'node:test'
import { request } from 'undici'
import { safeKill, start } from './helper.mjs'

process.setMaxListeners(100)

test('autostart', async t => {
  const { child, url } = await start([join(import.meta.url, '..', 'fixtures', 'hello', 'platformatic.service.json')])
  t.after(() => safeKill(child))

  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.strictEqual(body.hello, 'world')
})

test('start command', async t => {
  const { child, url } = await start([join(import.meta.url, '..', 'fixtures', 'hello', 'platformatic.service.json')])
  t.after(() => safeKill(child))

  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.strictEqual(body.hello, 'world')
})

test('allow custom env properties', async t => {
  const { child, url } = await start(['-c', join(import.meta.url, '..', 'fixtures', 'custom-port-placeholder.json')], {
    env: {
      A_CUSTOM_PORT: '11111'
    }
  })
  t.after(() => {
    safeKill(child)
    delete process.env.A_CUSTOM_PORT
  })

  assert.strictEqual(url, 'http://127.0.0.1:11111', 'A_CUSTOM_PORT env variable has been used')
  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)

  const body = await res.body.json()
  assert.strictEqual(body.message, 'Welcome to Platformatic! Please visit https://docs.platformatic.dev')
})
