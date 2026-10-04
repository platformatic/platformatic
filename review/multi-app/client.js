import http from 'node:http'
import http2 from 'node:http2'
import https from 'node:https'
import { performance } from 'node:perf_hooks'
const o = JSON.parse(process.argv[2])
const names = o.apps || ['catalog', 'rendering', 'search', 'personalization']
const weights = o.weights || [50, 20, 20, 10]
let random = o.seed * 7919
const rng = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296 }
const sessions = o.protocol.startsWith('h2') ? [http2.connect(`${o.protocol.endsWith('tls') ? 'https' : 'http'}://watt-multi-server:3000`, { rejectUnauthorized: false })] : []
sessions.forEach(s => s.on('error', () => {}))
const agents = Object.fromEntries(names.map(id => [id, new (o.protocol.endsWith('tls') ? https.Agent : http.Agent)({ keepAlive: true, maxSockets: 128, rejectUnauthorized: false })]))
const samples = [], errors = [], promises = [], lags = []
const arrivals = []
const count = Math.round(o.rate * o.seconds)
for (let i = 0; i < count; i++) {
  let r = rng() * weights.reduce((a, b) => a + b, 0), j = 0
  while (r >= weights[j] && j < names.length - 1) r -= weights[j++]
  const app = names[j]
  const ms = app === 'rendering' ? 100 + rng() * 300 : app === 'personalization' ? 30 + rng() * 120 : 1
  arrivals.push({ app, n: Math.max(1, Math.round(ms * o.iterationsPerMs)), rid: `${o.seed}-${i}`, due: i * 1000 / o.rate })
}
await new Promise(r => setTimeout(r, Math.max(0, o.startAt - Date.now())))
const start = performance.now()
function send (arrival) {
  const { app, n, rid } = arrival, due = start + arrival.due
  const path = `/${app}/work?n=${n}&rid=${rid}`
  lags.push(performance.now() - due)
  return new Promise(resolve => {
    let body = '', headers, done = false
    const finish = error => {
      if (done) return; done = true; clearTimeout(deadline)
      let value
      if (!error) { try { value = JSON.parse(body) } catch { error = 'invalid JSON' } }
      if (!error && ((headers.app !== undefined && headers.app !== app) || (value.app !== undefined && value.app !== app))) error = `invalid response ${JSON.stringify(headers)}`
      if (!error && headers.status === 503 && headers.rejected === '1' && value.code === 'PLT_REQUEST_CAPACITY_EXCEEDED' && value.statusCode === 503) error = 'capacity rejection'
      if (!error && headers.status >= 400 && headers.status <= 599) error = `HTTP ${headers.status}`
      if (!error && (headers.status !== 200 || headers.app !== app || value.app !== app || value.request !== rid || !Number.isInteger(value.worker) || value.worker < 0 || value.worker !== Number(headers.worker))) error = `invalid response ${JSON.stringify(headers)}`
      if (!error && o.requireGatewayIdentity && (!Number.isInteger(Number(headers.gateway)) || Number(headers.gateway) < 0 || Number(headers.gateway) >= o.frontends)) error = `invalid gateway identity ${JSON.stringify(headers)}`
      const result = { app, rid, latencyMs: performance.now() - due, endedMs: performance.now() - start,
        worker: Number(headers?.worker), gateway: Number(headers?.gateway), responseBody: error ? body : undefined, status: headers?.status, error: error ? String(error) : undefined }
      ;(error ? errors : samples).push(result); resolve()
    }
    let request
    if (sessions.length) {
      request = sessions[0].request({ ':path': path })
      request.on('response', h => { headers = { status: h[':status'], app: h['x-app'], worker: h['x-worker'], rejected: h['x-platformatic-request-rejected'], gateway: h['x-bench-gateway'] } })
      request.on('data', b => { body += b }); request.on('end', () => finish()); request.end()
    } else {
      request = (o.protocol.endsWith('tls') ? https : http).get({ hostname: 'watt-multi-server', port: 3000, path, agent: agents[app], rejectUnauthorized: false }, res => {
        headers = { status: res.statusCode, app: res.headers['x-app'], worker: res.headers['x-worker'], rejected: res.headers['x-platformatic-request-rejected'], gateway: res.headers['x-bench-gateway'] }
        res.on('data', b => { body += b }); res.on('end', () => finish()); res.on('error', finish)
      })
    }
    request.on('error', finish)
    const deadline = setTimeout(() => { request.destroy(); finish('deadline') }, Math.max(1, 30000 - (performance.now() - due)))
  })
}
for (const arrival of arrivals) {
  const due = start + arrival.due
  if (performance.now() < due) await new Promise(r => setTimeout(r, due - performance.now()))
  promises.push(send(arrival))
}
await Promise.all(promises)
const quantiles = values => {
  const a = values.sort((a, b) => a - b)
  return Object.fromEntries([['p50', .5], ['p95', .95], ['p99', .99]].map(([k, p]) => [k, a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null]))
}
console.log(JSON.stringify({ options: o, arrivals, samples, errors, drainMs: Math.max(0, performance.now() - start - o.seconds * 1000),
  generatorLagMs: quantiles(lags), apps: Object.fromEntries(names.map(app => [app, {
    offered: arrivals.filter(a => a.app === app).length, successes: samples.filter(a => a.app === app).length,
    goodput: samples.filter(a => a.app === app && a.endedMs <= o.seconds * 1000).length / o.seconds,
    latencyMs: quantiles(samples.filter(a => a.app === app).map(a => a.latencyMs)), errors: errors.filter(a => a.app === app).length
  }])) }))
Object.values(agents).forEach(a => a.destroy()); sessions.forEach(s => s.destroy())
