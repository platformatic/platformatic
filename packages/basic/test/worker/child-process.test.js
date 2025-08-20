import { deepStrictEqual, equal, ok, rejects } from 'node:assert'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { Agent, Client, setGlobalDispatcher } from 'undici'
import { createThreadInterceptor } from 'undici-thread-interceptor'
import { create, getExecutedCommandLogMessage } from '../helper.js'

function serverHandler (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  res.end(JSON.stringify({ ok: true }))
}

async function getChildManager (capability) {
  let manager = null

  while (!manager) {
    manager = capability.getChildManager()
    await setTimeout(10)
  }

  return manager
}

test('ChildProcess - can load a script with additional loader and scripts', async t => {
  const capability = await create(t)

  const executablePath = fileURLToPath(new URL('../fixtures/import-non-existing.js', import.meta.url))
  await capability.buildWithCommand(['node', executablePath], import.meta.dirname, {
    loader: new URL('../fixtures/loader.js', import.meta.url).toString(),
    scripts: [new URL('../fixtures/imported.js', import.meta.url)]
  })

  ok(capability.stdout.messages[0].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  deepStrictEqual(capability.stdout.messages.slice(1), ['IMPORTED', 'LOADED true'])
})

test('ChildProcess - the process will close upon request', async t => {
  const capability = await create(t)

  const executablePath = fileURLToPath(new URL('../fixtures/wait-for-close.js', import.meta.url))
  const promise = capability.buildWithCommand(['node', executablePath])
  const childManager = await getChildManager(capability)

  const [, socket] = await once(childManager, 'ready')
  await childManager.send(socket, 'close')
  await rejects(() => promise, /Process exited with non zero exit code/)
})

test('ChildProcess - the process exits in case of invalid messages', async t => {
  const capability = await create(t)

  const executablePath = fileURLToPath(new URL('../fixtures/wait-for-close.js', import.meta.url))
  const promise = capability.buildWithCommand(['node', executablePath])
  const childManager = await getChildManager(capability)

  await once(childManager, 'ready')

  childManager._send('INVALID', false)
  await rejects(() => promise, /Process exited with non zero exit code 21./)
})

test('ChildProcess - the process exits in case of errors', async t => {
  const capability = await create(t)

  const executablePath = fileURLToPath(new URL('../fixtures/delayed-error.js', import.meta.url))
  const promise = capability.buildWithCommand(['node', executablePath])
  await rejects(() => promise, /Process exited with non zero exit code 20./)
})

test('ChildProcess - should not modify HTTP options for UNIX sockets', async t => {
  const capability = await create(t)

  const executablePath = fileURLToPath(new URL('../fixtures/unix-socket-server.js', import.meta.url))
  const promise = capability.buildWithCommand(['node', executablePath])
  const childManager = await getChildManager(capability)

  const [path] = await once(childManager, 'path')

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
  const capability = await create(t, {
    isEntrypoint: true,
    serverConfig: {
      hostname: '123.123.123.123',
      port: 1000
    }
  })

  const executablePath = fileURLToPath(new URL('../fixtures/server.js', import.meta.url))
  const promise = capability.buildWithCommand(['node', executablePath])
  const childManager = await getChildManager(capability)

  const [error] = await once(childManager, 'error')

  deepStrictEqual(error.code, 'EADDRNOTAVAIL')
  await rejects(() => promise)
})

test('ChildProcess - should intercept fetch calls', async t => {
  const server = createServer(serverHandler).listen({ host: '127.0.0.1', port: 0 })
  await once(server, 'listening')

  const tcpWirer = new Worker(new URL('../fixtures/tcp-wirer.js', import.meta.url), {
    workerData: { port: server.address().port }
  })

  const interceptor = createThreadInterceptor({
    domain: '.plt.local' // The prefix for all local domains
  })

  interceptor.route('application', tcpWirer)
  setGlobalDispatcher(new Agent().compose(interceptor))

  const capability = await create(t, {
    isEntrypoint: true,
    serverConfig: {
      hostname: '123.123.123.123',
      port: 1000
    }
  })

  const executablePath = fileURLToPath(new URL('../fixtures/fetch.js', import.meta.url))
  const promise = capability.buildWithCommand(['node', executablePath], null, { context: { interceptLogging: true } })
  const manager = await getChildManager(capability)

  await once(manager, 'ready')

  ok(await manager.send(Array.from(manager.getClients())[0], 'start', server.address().port))

  await promise
  await server.close()
  tcpWirer.terminate()

  ok(capability.stdout.messages[0].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  deepStrictEqual(
    // eslint-disable-next-line no-control-regex
    capability.stdout.messages.slice(1).map(l => l.replace(/(\x1b\[[0-9;]+m)/gi, '')),
    [
      '200 { ok: true }',
      '200 { ok: true }',
      '200 { ok: true }',
      '502 No target found for application2.plt.local in thread 0.'
    ]
  )
})

test('ChildProcess - should properly setup globals', async t => {
  const capability = await create(t)

  const executablePath = fileURLToPath(new URL('../fixtures/import-non-existing.js', import.meta.url))
  await capability.buildWithCommand(['node', executablePath], import.meta.dirname, {
    loader: new URL('../fixtures/loader.js', import.meta.url).toString(),
    scripts: [new URL('../fixtures/imported.js', import.meta.url)]
  })
  capability.setOpenapiSchema('TEST_OPENAPI_SCHEMA')
  capability.setGraphqlSchema('TEST_GRAPHQL_SCHEMA')
  capability.setConnectionString('TEST_CONNECTION_STRING')

  equal(capability.openapiSchema, 'TEST_OPENAPI_SCHEMA')
  equal(capability.graphqlSchema, 'TEST_GRAPHQL_SCHEMA')
  equal(capability.connectionString, 'TEST_CONNECTION_STRING')
})
