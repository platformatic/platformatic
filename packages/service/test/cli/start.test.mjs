import { start, cliPath } from './helper.mjs'
import { test } from 'tap'
import { join } from 'desm'
import { request } from 'undici'
import { execa } from 'execa'

test('autostart', async ({ equal, same, match, teardown }) => {
  const { child, url } = await start('-c', join(import.meta.url, '..', '..', 'fixtures', 'hello', 'platformatic.service.json'))

  const res = await request(`${url}`)
  equal(res.statusCode, 200)
  const body = await res.body.json()
  match(body, {
    hello: 'world'
  }, 'response')

  child.kill('SIGINT')
})

test('start command', async ({ equal, same, match, teardown }) => {
  const { child, url } = await start('start', '-c', join(import.meta.url, '..', '..', 'fixtures', 'hello', 'platformatic.service.json'))

  const res = await request(`${url}`)
  equal(res.statusCode, 200)
  const body = await res.body.json()
  match(body, {
    hello: 'world'
  }, 'response')

  child.kill('SIGINT')
})

test('allow custom env properties', async ({ equal, same, match, teardown }) => {
  process.env.A_CUSTOM_PORT = '11111'
  const { child, url } = await start('start', '-c', join(import.meta.url, '..', 'fixtures', 'custom-port-placeholder.json'), '--allow-env=A_CUSTOM_PORT')
  equal(url, 'http://127.0.0.1:11111', 'A_CUSTOM_PORT env variable has been used')
  const res = await request(`${url}`)
  equal(res.statusCode, 200)
  const body = await res.body.json()
  match(body, {}, 'response')

  child.kill('SIGINT')
  delete process.env.A_CUSTOM_PORT
})

test('default logger', async ({ equal, same, match, teardown }) => {
  const { child, url } = await start('-c', join(import.meta.url, '..', '..', 'fixtures', 'hello', 'no-server-logger.json'))
  match(url, /http:\/\/127.0.0.1:[0-9]+/)
  child.kill('SIGINT')
})

test('plugin options', async ({ equal, same, match, teardown }) => {
  const { child, url } = await start('-c', join(import.meta.url, '..', '..', 'fixtures', 'options', 'platformatic.service.yml'))
  const res = await request(`${url}`)
  equal(res.statusCode, 200)
  const body = await res.body.json()
  match(body, {
    something: 'else'
  }, 'response')

  child.kill('SIGINT')
})

test('https embedded pem', async ({ equal, same, match, teardown }) => {
  const { child, url } = await start('-c', join(import.meta.url, '..', '..', 'fixtures', 'https', 'embedded-pem.json'))

  match(url, /https:\/\//)
  const res = await request(`${url}`)
  equal(res.statusCode, 200)
  const body = await res.body.json()
  match(body, {
    hello: 'world'
  }, 'response')

  child.kill('SIGINT')
})

test('https pem path', async ({ equal, same, match, teardown }) => {
  const { child, url } = await start('-c', join(import.meta.url, '..', '..', 'fixtures', 'https', 'pem-path.json'))

  match(url, /https:\/\//)
  const res = await request(`${url}`)
  equal(res.statusCode, 200)
  const body = await res.body.json()
  match(body, {
    hello: 'world'
  }, 'response')

  child.kill('SIGINT')
})

test('not load', async ({ rejects }) => {
  await rejects(execa('node', [cliPath, 'start', '-c', join(import.meta.url, '..', 'fixtures', 'not-load.service.json')]))
})
