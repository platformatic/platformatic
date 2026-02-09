import assert from 'assert'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { getGlobalDispatcher, MockAgent, request, setGlobalDispatcher } from 'undici'
import { createFromConfig } from './helper.js'

test('error', async t => {
  const file = join(os.tmpdir(), `some-plugin-${randomUUID()}.js`)

  await writeFile(
    file,
    `
    module.exports = async function (app) {
      app.get('/', () => {
        throw new Error('kaboom')
      })
    }`
  )

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [file]
    },
    watch: false
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/`)
  assert.strictEqual(res.statusCode, 500, 'add status code')

  const data = await res.body.json()
  assert.strictEqual(data.message, 'kaboom')
})

test('mock undici is supported', async t => {
  const previousAgent = getGlobalDispatcher()
  t.after(() => setGlobalDispatcher(previousAgent))

  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)

  const mockPool = mockAgent.get('http://localhost:42')

  // intercept the request
  mockPool
    .intercept({
      path: '/',
      method: 'GET'
    })
    .reply(200, {
      hello: 'world'
    })

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [join(import.meta.dirname, 'fixtures', 'undici-plugin.js')]
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await app.inject('/request')
  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(JSON.parse(res.body), { hello: 'world' })
})
