import { test } from 'node:test'
import { deepStrictEqual, strictEqual, ok } from 'node:assert'
import { join } from 'node:path'
import { Client } from 'undici'
import { connect } from 'node:http2'
import { createRuntime, updateConfigFile } from '../helpers.js'
import { prepareRuntime } from './helper.js'
async function start (t, h2 = false, configure) {
  const root = await prepareRuntime(t, 'request-routing', { gateway: ['gateway'], alpha: ['service', 'runtime'], beta: ['service', 'runtime'] })
  // Fixtures import the maintained transport's accounting API for assertions.
  const { symlink } = await import('node:fs/promises')
  await symlink(join(import.meta.dirname, '../../../../node_modules'), join(root, 'node_modules'), 'junction')
  if (h2) await updateConfigFile(join(root, 'platformatic.json'), c => { c.server.http2 = true })
  if (configure) await updateConfigFile(join(root, 'platformatic.json'), configure)
  const runtime = await createRuntime(join(root, 'platformatic.json'), null, { isProduction: true })
  t.after(() => runtime.close())
  return { runtime, url: await runtime.start() }
}

test('one persistent HTTP/1 connection balances requests within the correct application', async t => {
  const { url } = await start(t)
  const client = new Client(url); t.after(() => client.close())
  for (const app of ['alpha', 'beta']) {
    const workers = new Set()
    for (let i = 0; i < 8; i++) {
      const res = await client.request({ method: 'GET', path: `/${app}/work` })
      strictEqual(res.statusCode, 200)
      const value = await res.body.json(); strictEqual(value.app, app); workers.add(value.worker)
    }
    deepStrictEqual([...workers].sort(), [0, 1])
  }
})

test('HTTP/2 streams on one connection balance within each application', async t => {
  const { url } = await start(t, true)
  const client = connect(url.replace('https:', 'http:')); client.on('error', () => {}); t.after(() => client.destroy())
  const results = await Promise.all(['alpha', 'beta'].flatMap(app => [0, 1].map(() => new Promise((resolve, reject) => {
    const req = client.request({ ':path': `/${app}/work?ms=100` }); let data = ''
    req.on('data', b => { data += b }); req.on('end', () => resolve(JSON.parse(data))); req.on('error', reject); req.end()
  }))))
  for (const app of ['alpha', 'beta']) deepStrictEqual(results.filter(r => r.app === app).map(r => r.worker).sort(), [0, 1])
  client.destroy()
})

test('streaming bodies retain content and release reservations after response completion', async t => {
  const { url } = await start(t)
  const client = new Client(url); t.after(() => client.close())
  const { body } = await client.request({ method: 'GET', path: '/alpha/stream' })
  const data = Buffer.from(await body.arrayBuffer()); strictEqual(data.length, 131072)
  for (let i = 0; i < 8; i++) ok(data.subarray(i * 16384, (i + 1) * 16384).every(v => v === i))
  for (let i = 0; i < 4; i++) {
    const res = await client.request({ method: 'GET', path: '/alpha/state' })
    const value = await res.body.json(); strictEqual(value.outstanding, 1)
  }
})

async function waitFor (condition, timeout = 5000) {
  const until = Date.now() + timeout
  while (Date.now() < until) { if (await condition()) return; await new Promise(resolve => setTimeout(resolve, 10)) }
  throw new Error('Condition did not settle')
}

const outstanding = async (runtime, app) => Object.values(await runtime.getWorkers()).filter(w => w.application === app).reduce((n, w) => n + (w.requestRouting?.outstanding || 0), 0)

test('cancelling a client retains accepted backend work until it finishes', async t => {
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const signal = new AbortController()
  const result = request(url + '/alpha/work?ms=300', { signal: signal.signal }).catch(e => e)
  await waitFor(async () => await outstanding(runtime, 'alpha') === 1)
  signal.abort()
  const error = await result; strictEqual(error.name, 'AbortError')
  strictEqual(await outstanding(runtime, 'alpha'), 1)
  await waitFor(async () => await outstanding(runtime, 'alpha') === 0)
})

test('bounded admission rejects a busy app while another app continues serving', async t => {
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const work = Array.from({ length: 4 }, () => request(url + '/alpha/work?ms=400'))
  await waitFor(async () => await outstanding(runtime, 'alpha') === 4)
  const rejected = await request(url + '/alpha/work'); strictEqual(rejected.statusCode, 503); await rejected.body.dump()
  const beta = await request(url + '/beta/work'); strictEqual(beta.statusCode, 200); strictEqual((await beta.body.json()).app, 'beta')
  await Promise.all(work.map(async p => (await p).body.dump()))
  await waitFor(async () => await outstanding(runtime, 'alpha') === 0)
})

test('gateway exit retains accepted work and the backend releases it after completion', async t => {
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const result = request(url + '/alpha/work?ms=500').then(r => r.body.dump()).catch(e => e)
  await waitFor(async () => await outstanding(runtime, 'alpha') === 1)
  const gateways = Object.values(await runtime.getWorkers(true)).filter(w => w.application === 'gateway')
  await Promise.all(gateways.map(w => w.raw.terminate()))
  strictEqual(await outstanding(runtime, 'alpha'), 1)
  await result
  await waitFor(async () => await outstanding(runtime, 'alpha') === 0)
})

test('rolling replacement cannot charge new workers for old accepted requests', async t => {
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const work = request(url + '/alpha/work?ms=150').then(r => r.body.json())
  await waitFor(async () => await outstanding(runtime, 'alpha') === 1)
  await runtime.restartApplication('alpha')
  strictEqual((await work).app, 'alpha')
  await waitFor(async () => await outstanding(runtime, 'alpha') === 0)
  const response = await request(url + '/alpha/work'); strictEqual(response.statusCode, 200); await response.body.dump()
})

test('request routing refuses TCP mode instead of claiming backend completion knowledge', async t => {
  const root = await prepareRuntime(t, 'request-routing', { gateway: ['gateway'], alpha: ['service', 'runtime'], beta: ['service', 'runtime'] })
  await updateConfigFile(join(root, 'platformatic.json'), c => { c.applications[1].useHttp = true })
  const { rejects } = await import('node:assert')
  await rejects(() => createRuntime(join(root, 'platformatic.json'), null, { isProduction: true }), /requestRouting requires an internal in-process mesh application/)
})

test('aborting a streamed response releases its backend reservation', async t => {
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const response = await request(url + '/alpha/stream')
  strictEqual(await outstanding(runtime, 'alpha'), 1)
  response.body.on('error', () => {})
  response.body.destroy()
  await waitFor(async () => await outstanding(runtime, 'alpha') === 0)
})

test('streamed request bodies arrive intact and without application accounting hooks', async t => {
  const { url } = await start(t)
  const { request } = await import('undici')
  const { Readable } = await import('node:stream')
  const value = { values: Array.from({ length: 12000 }, (_, i) => i) }
  const bytes = Buffer.from(JSON.stringify(value))
  const response = await request(url + '/beta/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: Readable.from((function * () { for (let i = 0; i < bytes.length; i += 1000) yield bytes.subarray(i, i + 1000) })())
  })
  strictEqual(response.statusCode, 200); deepStrictEqual(await response.body.json(), value)
})

test('backend termination retires accepted reservations before replacing the generation', async t => {
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const result = request(url + '/alpha/work?ms=1000').then(async r => { await r.body.dump(); return r.statusCode }).catch(e => e)
  await waitFor(async () => await outstanding(runtime, 'alpha') === 1)
  const workers = Object.values(await runtime.getWorkers(true))
  const target = workers.find(w => w.application === 'alpha' && w.requestRouting.outstanding === 1)
  await target.raw.terminate()
  await waitFor(async () => await outstanding(runtime, 'alpha') === 0)
  ok((await result) !== 200)
  const response = await request(url + '/beta/work'); strictEqual(response.statusCode, 200); await response.body.dump()
})

test('routing metrics expose worker generations and count admission rejection once', async t => {
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const work = Array.from({ length: 4 }, () => request(url + '/alpha/work?ms=1000'))
  await waitFor(async () => await outstanding(runtime, 'alpha') === 4)
  const rejected = await request(url + '/alpha/work'); strictEqual(rejected.statusCode, 503); await rejected.body.dump()
  await Promise.all(work.map(async p => (await p).body.dump()))
  const metrics = await runtime.getMetrics()
  const rejects = metrics.metrics.filter(m => m.name === 'watt_request_routing_rejected_total')
  const total = rejects.flatMap(m => m.values).reduce((n, v) => n + v.value, 0)
  strictEqual(total, 1)
  ok(rejects.every(m => m.values.every(v => Number.isInteger(v.labels.threadId))))
})

test('shutdown cancels unread coordinator response bodies instead of waiting forever', async t => {
  const { runtime } = await start(t)
  const { request } = await import('undici')
  const response = await request('http://alpha.plt.local/stream', { dispatcher: runtime.getDispatcher() })
  response.body.on('error', () => {})
  strictEqual(await outstanding(runtime, 'alpha'), 1)
  const started = Date.now()
  await runtime.close()
  ok(Date.now() - started < 5000)
})

test('autodetected entrypoints cannot enable internal request routing', async t => {
  const root = await prepareRuntime(t, 'request-routing', { gateway: ['gateway'], alpha: ['service', 'runtime'], beta: ['service', 'runtime'] })
  await updateConfigFile(join(root, 'platformatic.json'), c => {
    delete c.entrypoint
    c.applications = c.applications.filter(a => a.id === 'alpha')
  })
  const { rejects } = await import('node:assert')
  await rejects(() => createRuntime(join(root, 'platformatic.json'), null, { isProduction: true }), /requestRouting requires an internal in-process mesh application/)
})

test('cancellation keeps synchronous CPU work reserved until backend production finishes', async t => {
  const { BroadcastChannel } = await import('node:worker_threads')
  const channel = new BroadcastChannel('watt.request-routing-tests')
  t.after(() => channel.close())
  const begun = new Promise(resolve => { channel.onmessage = ({ data }) => { if (data.request === 'cpu-cancellation') resolve() } })
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const signal = new AbortController()
  const work = request(url + '/alpha/cpu?ms=500&id=cpu-cancellation', { signal: signal.signal }).catch(e => e)
  await begun
  signal.abort()
  strictEqual((await work).name, 'AbortError')
  strictEqual(await outstanding(runtime, 'alpha'), 1)
  await waitFor(async () => await outstanding(runtime, 'alpha') === 0)
})

test('a completely unavailable application returns 503 while other applications serve', async t => {
  const { runtime, url } = await start(t, false, c => { c.applications.find(a => a.id === 'alpha').restartOnError = false })
  const { request } = await import('undici')
  const workers = Object.values(await runtime.getWorkers(true)).filter(w => w.application === 'alpha')
  await Promise.all(workers.map(w => w.raw.terminate()))
  await waitFor(async () => Object.values(await runtime.getWorkers()).filter(w => w.application === 'alpha').every(w => w.status === 'exited'))
  const alpha = await request(url + '/alpha/work')
  strictEqual(alpha.statusCode, 503); strictEqual((await alpha.body.json()).code, 'PLT_REQUEST_CAPACITY_EXCEEDED')
  const beta = await request(url + '/beta/work')
  strictEqual(beta.statusCode, 200); strictEqual((await beta.body.json()).app, 'beta')
})

test('draining immediately stops admission and retains outstanding metrics until completion', async t => {
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const work = request(url + '/alpha/work?ms=1200').then(async r => r.body.json())
  await waitFor(async () => await outstanding(runtime, 'alpha') === 1)
  const stop = runtime.stopApplication('alpha')
  await waitFor(async () => Object.values(await runtime.getWorkers()).some(w => w.application === 'alpha' && w.status === 'stopping' && w.requestRouting.outstanding === 1))
  const target = Object.values(await runtime.getWorkers()).find(w => w.application === 'alpha' && w.requestRouting.outstanding === 1)
  strictEqual(target.requestRouting.ready, 0)
  const metrics = (await runtime.getMetrics()).metrics.filter(m => m.name === 'watt_request_routing_outstanding')
  strictEqual(metrics.flatMap(m => m.values).filter(v => v.labels.applicationId === 'alpha').reduce((n, v) => n + v.value, 0), 1)
  strictEqual((await work).app, 'alpha')
  await stop
})

test('shutdown during a gateway crash restart preserves mesh exit acknowledgements', async t => {
  const { runtime } = await start(t, false, c => { c.restartOnError = 1 })
  const captured = Object.values(await runtime.getWorkers(true)).map(w => w.raw)
  const closed = new Promise((resolve, reject) => {
    runtime.once('application:worker:error', () => {
      // The restart runs on nextTick; close on the following turn while its
      // replacement is still booting, before it can send mesh acknowledgements.
      setImmediate(async () => {
        captured.push(...Object.values(await runtime.getWorkers(true)).map(w => w.raw))
        try { await runtime.close(); resolve() } catch (error) { reject(error) }
      })
    })
  })
  const gateway = Object.values(await runtime.getWorkers(true)).find(w => w.application === 'gateway')
  await gateway.raw.terminate()
  await closed
  ok(captured.every(worker => worker.threadId === -1))
})

test('backend errors release capacity for subsequent requests', async t => {
  const { runtime, url } = await start(t)
  const { request } = await import('undici')
  const failed = await request(url + '/alpha/fail')
  strictEqual(failed.statusCode, 500); await failed.body.dump()
  await waitFor(async () => await outstanding(runtime, 'alpha') === 0)
  const next = await request(url + '/alpha/work')
  strictEqual(next.statusCode, 200); await next.body.dump()
})

test('shared cache hits bypass worker reservation and preserve the cached response', async t => {
  const { runtime } = await start(t, false, c => { c.httpCache = true })
  const { request } = await import('undici')
  let value
  for (let i = 0; i < 5; i++) {
    const response = await request('http://alpha.plt.local/cached', { dispatcher: runtime.getDispatcher() })
    const body = await response.body.json()
    if (!value) value = body
    deepStrictEqual(body, value)
  }
  await waitFor(async () => await outstanding(runtime, 'alpha') === 0)
  const workers = Object.values(await runtime.getWorkers()).filter(w => w.application === 'alpha')
  strictEqual(workers.reduce((n, w) => n + w.requestRouting.selected, 0), 1)
})

test('gateway telemetry preserves trace context across the opted-in mesh', async t => {
  const { url } = await start(t, false, c => { c.telemetry = { applicationName: 'routing-test', exporter: { type: 'memory' } } })
  const { request } = await import('undici')
  const traceId = '0123456789abcdef0123456789abcdef'
  const response = await request(url + '/alpha/headers', { headers: { traceparent: `00-${traceId}-0123456789abcdef-01` } })
  strictEqual(response.statusCode, 200)
  strictEqual((await response.body.json()).traceparent.split('-')[1], traceId)
})

test('channel policies still block opted-in apps while permitted apps remain reachable', async t => {
  const { runtime, url } = await start(t, false, c => { c.policies = { deny: { gateway: 'alpha' } } })
  const { request } = await import('undici')
  const denied = await request(url + '/alpha/work')
  ok(denied.statusCode >= 400); await denied.body.dump()
  const alpha = Object.values(await runtime.getWorkers()).filter(w => w.application === 'alpha')
  strictEqual(alpha.reduce((n, w) => n + w.requestRouting.selected, 0), 0)
  const allowed = await request(url + '/beta/work')
  strictEqual(allowed.statusCode, 200); strictEqual((await allowed.body.json()).app, 'beta')
})
