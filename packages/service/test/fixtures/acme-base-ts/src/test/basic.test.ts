import { strictEqual } from 'node:assert'
import { test } from 'node:test'
import { create } from '../lib/index.js'

test('acme-base-ts - dynamite', async t => {
  const server = await create({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    dynamite: true
  })

  await server.init()

  const res = await server.inject('/dynamite')
  strictEqual(res.statusCode, 200)
  strictEqual(res.body, 'Kaboom!')
})

test('acme-base-ts - dynamite false', async t => {
  const server = await create({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    dynamite: false
  })

  await server.init()

  const res = await server.inject('/dynamite')
  strictEqual(res.statusCode, 404)
})

test('acme-base-ts - openapi', async t => {
  const server = await create({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    dynamite: true
  })

  await server.init()

  const res = await server.inject('/documentation/json')
  strictEqual(res.statusCode, 200)
  strictEqual(JSON.parse(res.body as unknown as string).info.title, 'Acme Microservice')
})
