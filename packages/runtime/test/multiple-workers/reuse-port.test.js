import { features } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime, updateConfigFile } from '../helpers.js'
import { prepareRuntime, waitForEvents } from './helper.js'

async function waitForPortRelease (port, attempts = 50, interval = 100) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const server = createServer()

    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', resolve)
      })

      await new Promise((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })

      return
    } catch {
      await sleep(interval)
    }
  }

  throw new Error(`Port ${port} was not released in time`)
}

test('applications are started with multiple workers even for the entrypoint when Node.js supports reusePort', async t => {
  const getPort = await import('get-port')
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const port = await getPort.default({ host: '127.0.0.1' })

  await waitForPortRelease(port)

  await updateConfigFile(configFile, contents => {
    contents.server = {
      hostname: '127.0.0.1',
      port
    }
    contents.autoload = undefined
  })

  const app = await createRuntime(configFile, null, { isProduction: true })

  t.after(async () => {
    await app.close()
  })

  const [workers, startMessages, stopMessages] = features.node.reusePort
    ? [
        5,
        [
          { event: 'application:worker:started', application: 'node', worker: 0 },
          { event: 'application:worker:started', application: 'node', worker: 1 },
          { event: 'application:worker:started', application: 'node', worker: 2 },
          { event: 'application:worker:started', application: 'node', worker: 3 },
          { event: 'application:worker:started', application: 'node', worker: 4 }
        ],
        [
          { event: 'application:worker:stopped', application: 'node', worker: 0 },
          { event: 'application:worker:stopped', application: 'node', worker: 1 },
          { event: 'application:worker:stopped', application: 'node', worker: 2 },
          { event: 'application:worker:stopped', application: 'node', worker: 3 },
          { event: 'application:worker:stopped', application: 'node', worker: 4 }
        ]
      ]
    : [
        1,
        [{ event: 'application:started', application: 'node' }],
        [{ event: 'application:stopped', application: 'node' }]
      ]

  const startMessagesPromise = waitForEvents(app, startMessages)

  const entryUrl = await app.start()
  await startMessagesPromise

  const usedWorkers = new Set()
  // Check that we get the response from different workers
  const promises = Array.from(Array(workers)).map(async () => {
    const res = await request(entryUrl + '/hello')
    const json = await res.body.json()

    deepStrictEqual(res.statusCode, 200)

    if (workers > 1) {
      const worker = res.headers['x-plt-worker-id']
      ok(worker.match(/^[01234]$/))

      usedWorkers.add(worker)
    }

    deepStrictEqual(json, { from: 'node' })
  })

  await Promise.all(promises)

  if (workers > 1) {
    ok(usedWorkers.size > 1)
  }

  const stopMessagesPromise = waitForEvents(app, stopMessages)

  await app.stop()
  await stopMessagesPromise
})
