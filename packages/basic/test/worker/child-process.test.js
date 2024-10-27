import { deepStrictEqual, rejects } from 'node:assert'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import pino from 'pino'
import { Client } from 'undici'
import { createMockedLogger, createStackable } from '../helper.js'

const pinoLevels = pino().levels.labels

function serverHandler (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  res.end(JSON.stringify({ ok: true }))
}

function forwardLogs (logger, logs) {
  for (const log of logs) {
    const level = pinoLevels[log.level]
    logger[level](log)
  }
}

test('ChildProcess - can load a script with additional loader and scripts', async t => {
  const stackable = createStackable()
  const { messages, logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/import-non-existing.js', import.meta.url))
  await stackable.buildWithCommand(
    ['node', executablePath],
    import.meta.dirname,
    new URL('../fixtures/loader.js', import.meta.url).toString(),
    [new URL('../fixtures/imported.js', import.meta.url)]
  )

  deepStrictEqual(messages, [
    ['DEBUG', `Executing "node ${executablePath}" ...`],
    ['INFO', 'IMPORTED'],
    ['INFO', 'LOADED true'],
    ['INFO', 'IMPORTED']
  ])
})

test('ChildProcess - the process will close upon request', async t => {
  const stackable = createStackable()
  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/wait-for-close.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])

  const childManager = stackable.getChildManager()
  await once(childManager, 'ready')
  childManager.close('SIGKILL')
  await rejects(() => promise, /Process exited with non zero exit code/)
})

test('ChildProcess - the process exits in case of invalid messages', async t => {
  const stackable = createStackable()
  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/wait-for-close.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])

  const childManager = stackable.getChildManager()
  await once(childManager, 'ready')

  childManager._send('INVALID', false)
  await rejects(() => promise, /Process exited with non zero exit code 21./)
})

test('ChildProcess - the process exits in case of errors', async t => {
  const stackable = createStackable()
  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/delayed-error.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])
  await rejects(() => promise, /Process exited with non zero exit code 20./)
})

test('ChildProcess - should not modify HTTP options for UNIX sockets', async t => {
  const stackable = createStackable()
  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/unix-socket-server.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])

  const [path] = await once(stackable.getChildManager(), 'path')

  {
    const client = new Client(
      {
        hostname: 'localhost',
        protocol: 'http:'
      },
      { socketPath: path }
    )

    const { statusCode, body: rawBody } = await client.request({
      method: 'GET',
      path: '/'
    })
    deepStrictEqual(statusCode, 200)

    const body = await rawBody.json()
    deepStrictEqual(body, { ok: true })
  }

  await promise
})

test('ChildProcess - should notify listen error', async t => {
  const stackable = createStackable({
    isEntrypoint: true,
    serverConfig: {
      hostname: '123.123.123.123',
      port: 1000
    }
  })

  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/server.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])

  const [error] = await once(stackable.getChildManager(), 'error')

  deepStrictEqual(error.code, 'EADDRNOTAVAIL')
  await rejects(() => promise)
})

test('ChildProcess - should intercept fetch calls', async t => {
  const server = createServer(serverHandler).listen({ host: '127.0.0.1', port: 0 })

  const stackable = createStackable({
    isEntrypoint: true,
    serverConfig: {
      hostname: '123.123.123.123',
      port: 1000
    }
  })

  const { messages, logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/fetch.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])

  const manager = stackable.getChildManager()
  manager._forwardLogs = forwardLogs.bind(null, logger)

  await once(manager, 'ready')

  manager.handle('fetch', opts => {
    switch (opts.path) {
      case '/error':
        throw new Error('FETCH ERROR')
      case '/foo': {
        const payload = JSON.stringify({ ok: true })
        return { statusCode: 200, headers: {}, body: payload, payload, rawPayload: Buffer.from(payload) }
      }
      case '/bar': {
        const payload = JSON.stringify({ ok: true })
        return {
          statusCode: 200,
          headers: { a: ['1', '2'], b: '3' },
          body: payload,
          payload,
          rawPayload: Buffer.from(payload)
        }
      }
    }
  })

  await manager.send(Array.from(manager.getClients())[0], 'start', server.address().port)

  await promise
  await server.close()

  deepStrictEqual(messages[0], ['DEBUG', `Executing "node ${executablePath}" ...`])
  deepStrictEqual(
    // eslint-disable-next-line no-control-regex
    messages.slice(1).map(l => [l[0], l[1].level, l[1].raw.trim().replace(/\x1B\[33m|\x1B\[39m/g, '')]),
    [
      ['INFO', 30, '200 { ok: true }'],
      ['INFO', 30, '200 { ok: true }'],
      ['INFO', 30, '200 { ok: true }'],
      ['ERROR', 50, 'Handler failed with error: FETCH ERROR']
    ]
  )
})
