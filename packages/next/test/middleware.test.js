import { deepStrictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should make a request with a custom interceptor from a middleware', async t => {
  const { root, config } = await prepareRuntime(t, 'middleware', true)
  const { url } = await startRuntime(t, root, config, false, ['frontend'])

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)

  const data = await body.text()
  deepStrictEqual(data, JSON.stringify({
    success: true,
    message: 'middleware',
    status: 200,
    data: {
      hello: 'world',
      intercepted: true
    }
  }))
})

test('should make a request with a custom interceptor from a middleware (child process)', async t => {
  const { root, config } = await prepareRuntime(t, 'middleware-child-process', true)
  const { url } = await startRuntime(t, root, config, false, ['frontend'])

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)

  const data = await body.text()

  deepStrictEqual(data, JSON.stringify({
    success: true,
    message: 'middleware',
    status: 200,
    data: {
      hello: 'world',
      intercepted: true
    }
  }))
})
