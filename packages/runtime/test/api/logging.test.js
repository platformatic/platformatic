'use strict'

const { strictEqual, deepStrictEqual } = require('node:assert')
const { join } = require('node:path')
const { hostname: getHostname } = require('node:os')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { Client } = require('undici')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('logs stdio from the service thread', async t => {
  const configFile = join(fixturesDir, 'configs', 'service-with-stdio.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  const url = await app.start()
  const pid = process.pid
  const hostname = getHostname()

  t.after(async () => {
    await app.close()
  })

  {
    const { statusCode, body } = await app.inject('stdio', '/')

    strictEqual(statusCode, 200)
    deepStrictEqual(JSON.parse(body), { ok: true })
  }

  {
    const client = new Client(
      {
        hostname: 'localhost',
        protocol: 'http:',
      },
      {
        socketPath: app.getManagementApiUrl(),
        keepAliveTimeout: 10,
        keepAliveMaxTimeout: 10,
      }
    )

    await sleep(3000)

    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/logs/all',
    })

    strictEqual(statusCode, 200)

    const messages = (await body.text())
      .trim()
      .split('\n')
      .map(l => {
        const { level, pid, hostname, name, msg, payload } = JSON.parse(l)
        return { level, pid, hostname, name, msg, payload }
      })

    deepStrictEqual(messages, [
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is an info',
        payload: undefined,
      },
      {
        level: 40,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is a warn',
        payload: undefined,
      },
      {
        level: 40,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is an error',
        payload: undefined,
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: `Server listening at ${url}`,
        payload: undefined,
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: 'incoming request',
        payload: undefined,
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is a\n console.log',
        payload: undefined,
      },
      {
        level: 50,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is a\n console.error',
        payload: undefined,
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: undefined,
        payload: { ts: '123', foo: 'bar' },
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: '#'.repeat(1e4),
        payload: undefined,
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: '<Buffer 00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 21 22 23 24 25 26 27 28 29 2a 2b 2c 2d 2e 2f 30 31 ... 50 more bytes>',
        payload: undefined,
      },
      {
        level: 10,
        pid,
        hostname,
        name: undefined,
        msg: 'This is a trace',
        payload: undefined,
      },
      {
        level: 60,
        pid,
        hostname,
        name: undefined,
        msg: 'This is a fatal with object',
        payload: { ts: '123', foo: 'bar' },
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: 'request completed',
        payload: undefined,
      },
    ])
  }
})
