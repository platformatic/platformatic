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

test('not load', async ({ rejects }) => {
  await rejects(execa('node', [cliPath, 'start', '-c', join(import.meta.url, '..', 'fixtures', 'not-load.service.json')]))
})
