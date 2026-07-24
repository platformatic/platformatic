import { deepStrictEqual, ok } from 'node:assert'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { features } from '@platformatic/foundation'
import { Agent, request } from 'undici'
import { prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const repoRoot = resolve(import.meta.dirname, '../../..')

function createDispatcher (t, options = {}) {
  const dispatcher = new Agent({
    ...options,
    connect: {
      rejectUnauthorized: false
    }
  })

  t.after(() => dispatcher.close())
  return dispatcher
}

async function getPort () {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  server.close()
  await once(server, 'close')
  return port
}

test('supports https server options', async t => {
  const dispatcher = createDispatcher(t)

  const { runtime } = await prepareRuntime(t, 'node-https-standalone', false, null, async (root, config) => {
    config.applications[0].permissions = { fs: { read: ['.', repoRoot] } }
    config.applications[0].server.https = {
      key: { path: resolve(root, 'https.key') },
      cert: { path: resolve(root, 'https.crt') }
    }
  })

  const url = await startRuntime(t, runtime)

  ok(url.startsWith('https://'))

  const res = await request(url + '/', { dispatcher })
  deepStrictEqual(res.statusCode, 200)
  deepStrictEqual(await res.body.json(), { production: false })
})

test('supports reusePort with https server options', async t => {
  // The kernel balances SO_REUSEPORT sockets by hashing the connection 4-tuple,
  // so requests riding a kept-alive connection always hit the same worker.
  // Disable keep-alive to open a fresh connection (and get a new hash) on
  // every request.
  const dispatcher = createDispatcher(t, { pipelining: 0 })
  const port = await getPort()

  const { runtime } = await prepareRuntime(t, 'node-https-standalone', false, null, async (root, config) => {
    config.applications[0].server = {
      ...config.applications[0].server,
      port,
      https: {
        key: { path: resolve(root, 'https.key') },
        cert: { path: resolve(root, 'https.crt') }
      }
    }
    config.applications[0].workers = { static: 5, dynamic: false }
    config.applications[0].permissions = { fs: { read: ['.', repoRoot] } }
  })

  const url = await startRuntime(t, runtime)
  deepStrictEqual(url, `https://127.0.0.1:${port}`)

  const workers = features.node.reusePort ? 5 : 1
  let attempts = 0
  const usedWorkers = new Set(Array.from(Array(workers)).map((_, i) => i.toString()))

  // The kernel hashing is not a strict round-robin: give it plenty of
  // attempts to eventually hit every worker at least once.
  while (usedWorkers.size > 0 && attempts++ < workers * 40) {
    const res = await request(url + '/', { dispatcher })
    const json = await res.body.json()

    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(json.production, false)
    usedWorkers.delete(res.headers['x-plt-worker-id'])
  }

  deepStrictEqual(usedWorkers.size, 0, `workers never hit after ${attempts} requests: ${Array.from(usedWorkers).join(', ')}`)
})
