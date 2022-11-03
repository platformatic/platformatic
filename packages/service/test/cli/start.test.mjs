import { start } from './helper.mjs'
import { test } from 'tap'
import { join } from 'desm'
import { request } from 'undici'

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
  const { child } = await start('start', '-c', join(import.meta.url, '..', '..', 'fixtures', 'hello', 'platformatic.service.json'))

  child.kill('SIGINT')
})

test('default logger', async ({ equal, same, match, teardown }) => {
  const { child, url } = await start('-c', join(import.meta.url, '..', '..', 'fixtures', 'hello', 'no-server-logger.json'))
  match(url, /http:\/\/127.0.0.1:[0-9]+/)
  child.kill('SIGINT')
})
