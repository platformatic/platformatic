import { test } from 'node:test'
import { buildServer } from '../lib/index.js'
import { strictEqual } from 'node:assert'

test('dynamite', async () => {
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

test('dynamite false', async () => {
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

test('openapi', async () => {
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
