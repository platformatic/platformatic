import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { execa } from 'execa'
import { start, cliPath } from './helper.mjs'

test('autostart', async (t) => {
  const { child, url } = await start(['-c', join(import.meta.url, '..', '..', 'fixtures', 'hello', 'platformatic.service.json')])

  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.strictEqual(body.hello, 'world')

  child.kill('SIGINT')
})

test('start command', async (t) => {
  const { child, url } = await start(['-c', join(import.meta.url, '..', '..', 'fixtures', 'hello', 'platformatic.service.json')])

  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.strictEqual(body.hello, 'world')

  child.kill('SIGINT')
})

test('allow custom env properties', async (t) => {
  const { child, url } = await start(
    [
      '-c', join(import.meta.url, '..', 'fixtures', 'custom-port-placeholder.json'),
      '--allow-env', 'A_CUSTOM_PORT'
    ],
    {
      env: {
        A_CUSTOM_PORT: '11111'
      }
    }
  )
  t.after(() => {
    child.kill('SIGINT')
    delete process.env.A_CUSTOM_PORT
  })

  assert.strictEqual(url, 'http://127.0.0.1:11111', 'A_CUSTOM_PORT env variable has been used')
  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)

  const body = await res.body.json()
  assert.strictEqual(body.message, 'Welcome to Platformatic! Please visit https://docs.platformatic.dev')
})

test('use default env variables names', async (t) => {
  const { child, url } = await start(
    [
      '-c', join(import.meta.url, '..', 'fixtures', 'default-env-var-names.json')
    ],
    {
      env: {
        PORT: '11111',
        HOSTNAME: '127.0.0.1'
      }
    }
  )
  t.after(() => {
    child.kill('SIGINT')
    delete process.env.A_CUSTOM_PORT
  })

  assert.strictEqual(url, 'http://127.0.0.1:11111', 'default env variable names has been used')
  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)
})

test('default logger', async (t) => {
  const { child, url } = await start(['-c', join(import.meta.url, '..', '..', 'fixtures', 'hello', 'no-server-logger.json')])
  assert.match(url, /http:\/\/127.0.0.1:[0-9]+/)
  child.kill('SIGINT')
})

test('plugin options', async (t) => {
  const { child, url } = await start(['-c', join(import.meta.url, '..', '..', 'fixtures', 'options', 'platformatic.service.yml')])
  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.strictEqual(body.something, 'else')

  child.kill('SIGINT')
})

test('https embedded pem', async (t) => {
  const { child, url } = await start(['-c', join(import.meta.url, '..', '..', 'fixtures', 'https', 'embedded-pem.json')])

  assert.match(url, /https:\/\//)
  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.deepStrictEqual(body, {
    hello: 'world'
  }, 'response')

  child.kill('SIGINT')
})

test('https pem path', async (t) => {
  const { child, url } = await start(['-c', join(import.meta.url, '..', '..', 'fixtures', 'https', 'pem-path.json')])

  assert.match(url, /https:\/\//)
  const res = await request(`${url}`)
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.deepStrictEqual(body, {
    hello: 'world'
  }, 'response')

  child.kill('SIGINT')
})

test('not load', async (t) => {
  await assert.rejects(execa('node', [cliPath, 'start', '-c', join(import.meta.url, '..', 'fixtures', 'not-load.service.json')]))
})

test('no server', async ({ equal, same, match, teardown }) => {
  const { child, url } = await start(['-c', join(import.meta.url, '..', '..', 'fixtures', 'no-server', 'platformatic.service.json')])
  match(url, /http:\/\/127.0.0.1:[0-9]+/)
  child.kill('SIGINT')
})
