import { deepStrictEqual } from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareRuntime } from '../../basic/test/helper.js'

test('React Router application should properly process request body in development', async t => {
  const { runtime } = await prepareRuntime({ t, root: path.resolve(import.meta.dirname, './fixtures/request-body') })

  const url = await runtime.start()

  const now = Date.now()
  const { statusCode, body } = await request(url + '/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ timestamp: now })
  })

  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), { timestamp: now })
})

test('React Router application should properly process request body in production', async t => {
  const { runtime } = await prepareRuntime({
    t,
    root: path.resolve(import.meta.dirname, './fixtures/request-body'),
    build: true,
    production: true
  })

  const url = await runtime.start()

  const now = Date.now()
  const { statusCode, body } = await request(url + '/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ timestamp: now })
  })

  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), { timestamp: now })
})
