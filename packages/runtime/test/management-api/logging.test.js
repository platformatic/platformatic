import { ok } from 'node:assert'
import { platform } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import WebSocket from 'ws'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should log management api requests using the runtime logger', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.init()

  const socketPath = app.getManagementApiUrl()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath,
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), app.close()])
  })

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  const messages = []
  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 10000)

    webSocket.on('error', reject)

    webSocket.on('message', data => {
      const message = data.toString()
      messages.push(message)

      if (message.includes('/api/v1/pizza')) {
        clearTimeout(timeout)

        setImmediate(() => {
          webSocket.terminate()
          resolve()
        })
      }
    })
  })

  await new Promise(resolve => webSocket.on('open', resolve))

  // Frequently polled endpoints are not logged ...
  await client.request({ method: 'GET', path: '/api/v1/status' }).then(res => res.body.text())

  // ... while all the other ones are.
  await client.request({ method: 'GET', path: '/api/v1/pizza' }).then(res => res.body.text())

  await promise

  ok(messages.some(message => message.includes('incoming request') && message.includes('/api/v1/pizza')))
  ok(!messages.some(message => message.includes('/api/v1/status')))
})
