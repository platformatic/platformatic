import { strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { create } from '../index.js'

const root = resolve(import.meta.dirname, '../')

test('dynamite', async t => {
  const server = await create(root, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    dynamite: true
  })

  t.after(() => server.stop())
  await server.start({ listen: true })

  const res = await server.inject('/dynamite')
  strictEqual(res.statusCode, 200)
  strictEqual(res.body, 'Kaboom!')
})

test('dynamite false', async t => {
  const server = await create(root, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    dynamite: false
  })

  t.after(() => server.stop())
  await server.start({ listen: true })

  const res = await server.inject('/dynamite')
  strictEqual(res.statusCode, 404)
})

test('openapi', async t => {
  const server = await create(root, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    dynamite: true
  })

  t.after(() => server.stop())
  await server.start({ listen: true })

  const res = await server.inject('/documentation/json')
  strictEqual(res.statusCode, 200)
  strictEqual(JSON.parse(res.body).info.title, 'Acme Microservice')
})
