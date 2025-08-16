'use strict'

const { ok, strictEqual, deepStrictEqual } = require('node:assert')
const { join } = require('node:path')
const { hostname: getHostname } = require('node:os')
const { test } = require('node:test')
const { createRuntime, readLogs } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('logs stdio from the service thread', async t => {
  const configFile = join(fixturesDir, 'configs', 'service-with-stdio.json')
  const context = {}
  const app = await createRuntime(configFile, null, context)

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
    const text = await readLogs(context.logsPath, 3000, true)
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
  const configFile = join(fixturesDir, 'configs', 'monorepo-with-node.json')
  const context = {}
  const app = await createRuntime(configFile, null, context)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  {
    const { statusCode } = await app.inject('node', '/')
    strictEqual(statusCode, 200)
  }

  {
    const text = await readLogs(context.logsPath, 3000, true)
    const messages = text
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
  const configFile = join(fixturesDir, 'isotime-logs', 'platformatic.json')
  const context = {}
  const app = await createRuntime(configFile, null, context)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  {
    const { statusCode } = await app.inject('hello', '/')
    strictEqual(statusCode, 200)
  }

  {
    const text = await readLogs(context.logsPath, 3000, true)
    const messages = text
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
