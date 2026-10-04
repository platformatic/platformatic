import { workerData, BroadcastChannel } from 'node:worker_threads'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
import { pbkdf2Sync } from 'node:crypto'
const require = createRequire(import.meta.url)
const { snapshot } = require('@platformatic/runtime/lib/mesh/lib/request-routing.js')
export default async function (app) {
  const channel = new BroadcastChannel('watt.request-routing-tests')
  app.addHook('onClose', async () => channel.close())
  app.get('/cpu', req => {
    channel.postMessage({ request: req.query.id })
    const until = Date.now() + Number(req.query.ms || 0)
    while (Date.now() < until) pbkdf2Sync('request-test', 'fixed', 1000, 16, 'sha256')
    return { app: workerData.applicationConfig.id, worker: workerData.worker.index }
  })
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-worker', String(workerData.worker.index))
    reply.header('x-app', workerData.applicationConfig.id)
  })
  app.get('/work', async req => {
    await new Promise(resolve => setTimeout(resolve, Number(req.query.ms || 0)))
    return { app: workerData.applicationConfig.id, worker: workerData.worker.index }
  })
  app.get('/stream', (req, reply) => reply.type('application/octet-stream').send(Readable.from((async function * () {
    for (let i = 0; i < 8; i++) { yield Buffer.alloc(16384, i); await new Promise(resolve => setTimeout(resolve, 15)) }
  })())))
  app.get('/fail', () => { throw new Error('Expected backend failure') })
  app.get('/headers', req => req.headers)
  let cached = 0
  app.get('/cached', (req, reply) => reply.header('cache-control', 'public, s-maxage=60').send({ counter: ++cached, worker: workerData.worker.index }))
  app.post('/echo', async req => req.body)
  app.get('/state', () => snapshot(workerData.requestRouting))
}
