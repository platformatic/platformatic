import { features } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { configurationFileIn, createRuntime, updateConfigFile } from '../helpers.js'
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

test('applications are started with multiple workers when Node.js supports reusePort', async t => {
  const getPort = await import('get-port')
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = configurationFileIn(root)
  const port = await getPort.default({ host: '127.0.0.1' })

  await waitForPortRelease(port)

  await updateConfigFile(configurationFileIn(resolve(root, 'node')), contents => {
    contents.server = {
      hostname: '127.0.0.1',
      port
    }
  })
  await updateConfigFile(configFile, contents => {
    contents.autoload = undefined
    contents.metrics = { port: 0 }
    contents.applications[0].workers = features.node.reusePort ? 5 : 1
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

  const { 'node:0': nodeUrl } = await app.start()
  await startMessagesPromise

  const usedWorkers = new Set()

  async function sampleWorkers () {
    const promises = Array.from(Array(workers)).map(async () => {
      const res = await request(nodeUrl + '/hello')
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
  }

  await sampleWorkers()

  if (workers > 1) {
    /*
      Which worker accepts a connection is the kernel's decision under SO_REUSEPORT, and it is free
      to send a whole batch to one of them. What is being tested is that more than one worker *can*
      answer, so the batch repeats until it has seen that -- a single round asserts a distribution
      nobody promised, and failed on a busy runner while the runtime was working exactly as intended.
    */
    const deadline = Date.now() + 30_000

    while (usedWorkers.size < 2 && Date.now() < deadline) {
      await sampleWorkers()
    }

    ok(usedWorkers.size > 1)
  }

  const stopMessagesPromise = waitForEvents(app, stopMessages)

  await app.stop()
  await stopMessagesPromise
})
