'use strict'

const os = require('node:os')
const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { request } = require('undici')
const { buildServer } = require('..')
const { setTimeout: sleep } = require('timers/promises')
const fs = require('fs/promises')
const { safeRemove } = require('@platformatic/utils')

test('config is adjusted to handle custom loggers', async t => {
  const options = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      loggerInstance: {
        level: 'trace',
        info () {},
        error () {},
        debug () {},
        fatal () {},
        warn () {},
        trace () {},
      },
    },
  }

  let called = false
  Object.defineProperty(options.server.loggerInstance, 'child', {
    value: function child () {
      called = true
      return this
    },
    enumerable: false,
  })

  await buildServer(options)
  assert.strictEqual(called, true)
})

test('do not watch typescript outDir', async t => {
  process.env.PLT_CLIENT_URL = 'http://localhost:3042'
  const targetDir = join(__dirname, '..', 'fixtures', 'hello-client-ts')

  try {
    await safeRemove(join(targetDir, 'dist'))
  } catch {}

  const app = await buildServer(join(targetDir, 'platformatic.service.json'))
  t.after(async () => {
    await app.close()
  })

  assert.deepStrictEqual(app.platformatic.configManager.current.watch, {
    enabled: false,
    ignore: ['dist/**/*'],
  })
})

test('start without server config', async t => {
  const app = await buildServer({
    watch: false,
    metrics: false,
  })
  t.after(async () => {
    await app.close()
  })

  const url = await app.start()
  const res = await request(url)
  assert.strictEqual(res.statusCode, 200, 'add status code')
  assert.deepStrictEqual(await res.body.json(), {
    message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev',
  })
})

test('transport logger', async t => {
  const file = join(os.tmpdir(), `${process.pid}-4.json`)
  const options = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'info',
        transport: {
          target: join(__dirname, 'fixtures', 'custom-transport.js'),
          options: {
            path: file,
          },
        },
      },
    },
  }

  const server = await buildServer(options)
  await server.start()
  await server.close()

  await sleep(500)

  const written = await fs.readFile(file, 'utf8')
  const parsed = JSON.parse(written)

  assert.strictEqual(parsed.fromTransport, true)
})
