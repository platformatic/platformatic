'use strict'

const { ok, strictEqual, deepStrictEqual } = require('node:assert')
const { join } = require('node:path')
const { hostname: getHostname, tmpdir } = require('node:os')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { Client } = require('undici')

const { safeRemove } = require('@platformatic/utils')
const { create } = require('../../index.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

function hideLogs (t) {
  const originalEnv = process.env.PLT_RUNTIME_LOGGER_STDOUT

  if (!originalEnv) {
    return
  }

  process.env.PLT_RUNTIME_LOGGER_STDOUT = join(tmpdir(), `test-runtime-${process.pid}-${Date.now()}-stdout.log`)

  t.after(async () => {
    await safeRemove(process.env.PLT_RUNTIME_LOGGER_STDOUT)
    process.env.PLT_RUNTIME_LOGGER_STDOUT = originalEnv
  })
}

test('logs stdio from the service thread', async t => {
  hideLogs(t)

  const configFile = join(fixturesDir, 'configs', 'service-with-stdio.json')
  const app = await create(configFile)

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
        protocol: 'http:'
      },
      {
        socketPath: app.getManagementApiUrl(),
        keepAliveTimeout: 10,
        keepAliveMaxTimeout: 10
      }
    )

    await sleep(3000)

    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/logs/all'
    })

    strictEqual(statusCode, 200)

    const text = await body.text()
    const messages = text
      .trim()
      .split('\n')
      .map(l => {
        const { level, pid, hostname, name, msg, payload, stdout } = JSON.parse(l)
        return { level, pid, hostname, name, msg, payload, stdout }
      })
      .filter(m => m.msg !== 'Runtime event')

    const serviceMessages = messages.filter(m => m.name === 'stdio')
    const runtimeMessages = messages.filter(m => m.name === undefined)

    deepStrictEqual(serviceMessages, [
      {
        level: 20,
        pid,
        hostname,
        name: 'stdio',
        msg: 'Loading envfile...',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is an info',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 40,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is a warn',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 50,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is an error',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: `Server listening at ${url}`,
        payload: undefined,
        stdout: undefined
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: 'incoming request',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is a\n console.log',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 50,
        pid,
        hostname,
        name: 'stdio',
        msg: 'This is a\n console.error',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: undefined,
        payload: undefined,
        stdout: { ts: '123', foo: 'bar' }
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: '#'.repeat(1e4),
        payload: undefined,
        stdout: undefined
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: '<Buffer 00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 21 22 23 24 25 26 27 28 29 2a 2b 2c 2d 2e 2f 30 31 ... 50 more bytes>',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 30,
        pid,
        hostname,
        name: 'stdio',
        msg: 'request completed',
        payload: undefined,
        stdout: undefined
      }
    ])

    deepStrictEqual(runtimeMessages, [
      {
        level: 30,
        pid,
        hostname,
        name: undefined,
        msg: 'Starting the service "stdio"...',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 30,
        pid,
        hostname,
        name: undefined,
        msg: 'Started the service "stdio"...',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 30,
        pid,
        hostname,
        name: undefined,
        msg: `Platformatic is now listening at ${url}`,
        payload: undefined,
        stdout: undefined
      },
      {
        level: 10,
        pid,
        hostname,
        name: undefined,
        msg: 'This is a trace',
        payload: undefined,
        stdout: undefined
      },
      {
        level: 60,
        pid,
        hostname,
        name: undefined,
        msg: 'This is a fatal with object',
        payload: { ts: '123', foo: 'bar' },
        stdout: undefined
      }
    ])
  }
})

test('logs with caller info', async t => {
  hideLogs(t)

  const configFile = join(fixturesDir, 'configs', 'monorepo-with-node.json')
  const app = await create(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  {
    const { statusCode } = await app.inject('node', '/')
    strictEqual(statusCode, 200)
  }

  {
    const client = new Client(
      {
        hostname: 'localhost',
        protocol: 'http:'
      },
      {
        socketPath: app.getManagementApiUrl(),
        keepAliveTimeout: 10,
        keepAliveMaxTimeout: 10
      }
    )

    await sleep(3000)

    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/logs/all'
    })

    strictEqual(statusCode, 200)

    const messages = (await body.text())
      .trim()
      .split('\n')
      .map(l => {
        const { level, pid, hostname, name, msg, payload, caller } = JSON.parse(l)
        return { level, pid, hostname, name, msg, payload, caller }
      })

    const expecteds = [
      { level: 30, name: 'node', msg: 'This is console.debug', caller: 'STDOUT' },
      { level: 30, name: 'node', msg: 'This is console.info', caller: 'STDOUT' },
      { level: 30, name: 'node', msg: 'This is console.log', caller: 'STDOUT' },
      { level: 50, name: 'node', msg: 'This is console.warn', caller: 'STDERR' },
      { level: 50, name: 'node', msg: 'This is console.error', caller: 'STDERR' },
      { level: 50, name: 'node', msg: 'Trace: This is console.trace', caller: 'STDERR' }
    ]

    for (const e of expecteds) {
      ok(
        messages.find(m => {
          return m.level === e.level && m.name === e.name && m.msg.startsWith(e.msg) && m.caller === e.caller
        })
      )
    }
  }
})

test('isoTime support', async t => {
  hideLogs(t)

  const configFile = join(fixturesDir, 'isotime-logs', 'platformatic.json')
  const app = await create(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  {
    const { statusCode } = await app.inject('hello', '/')
    strictEqual(statusCode, 200)
  }

  {
    const client = new Client(
      {
        hostname: 'localhost',
        protocol: 'http:'
      },
      {
        socketPath: app.getManagementApiUrl(),
        keepAliveTimeout: 10,
        keepAliveMaxTimeout: 10
      }
    )

    await sleep(3000)

    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/logs/all'
    })

    strictEqual(statusCode, 200)

    const messages = (await body.text())
      .trim()
      .split('\n')
      .map(l => {
        const { level, pid, hostname, name, msg, payload, stdout } = JSON.parse(l)
        return { level, pid, hostname, name, msg, payload, stdout }
      })

    const expected = [{ level: 30, name: 'hello', msg: 'Request received' }]

    for (const e of expected) {
      ok(
        messages.find(m => {
          return m.level === e.level && m.name === e.name && m.stdout?.msg?.startsWith(e.msg)
        })
      )
    }
  }
})
