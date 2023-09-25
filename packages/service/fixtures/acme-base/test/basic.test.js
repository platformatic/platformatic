import { test } from 'node:test'
import { buildServer } from '../index.js'
import { strictEqual } from 'node:assert'

test('dynamite', async (t) => {
  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    dynamite: true
  })

  const res = await server.inject('/dynamite')
  strictEqual(res.statusCode, 200)
  strictEqual(res.body, 'Kaboom!')
})

test('dynamite false', async (t) => {
  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    dynamite: false
  })

  const res = await server.inject('/dynamite')
  strictEqual(res.statusCode, 404)
})

test('openapi', async (t) => {
  const server = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    dynamite: true
  })

  const res = await server.inject('/documentation/json')
  strictEqual(res.statusCode, 200)
  strictEqual(res.json().info.title, 'Acme Microservice')
})
