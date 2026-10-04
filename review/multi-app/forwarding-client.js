import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import http from 'node:http'
import http2 from 'node:http2'
import { performance } from 'node:perf_hooks'
const quantile = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null
if (isMainThread) {
  const opts = JSON.parse(process.argv[2])
  const reports = await Promise.all(Array.from({ length: opts.clients || 4 }, (_, index) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { ...opts, index } })
    worker.on('message', resolve); worker.on('error', reject)
    worker.on('exit', code => { if (code) reject(new Error(`client exit ${code}`)) })
  })))
  const all = reports.flatMap(r => r.samples)
  function summary (samples) {
    const a = samples.map(s => s[0]).sort((a, b) => a - b)
    return { count: a.length, p50: quantile(a, .5), p95: quantile(a, .95), p99: quantile(a, .99), max: a.at(-1) ?? null }
  }
  const histogram = {}
  for (const [ms] of all) { const bucket = Math.round(ms * 10) / 10; histogram[bucket] = (histogram[bucket] || 0) + 1 }
  console.log(JSON.stringify({ options: opts, scheduled: reports.reduce((a, r) => a + r.scheduled, 0),
    completed: all.length, completedInWindow: all.filter(s => s[3] <= opts.seconds * 1000).length,
    rps: all.filter(s => s[3] <= opts.seconds * 1000).length / opts.seconds,
    drainedRps: all.length / (opts.seconds + Math.max(...reports.map(r => r.drainMs)) / 1000),
    errors: reports.flatMap(r => r.errors), workers: Array.from({ length: 4 }, (_, i) => all.filter(s => s[2] === i).length),
    latencyMs: summary(all), lightMs: summary(all.filter(s => !s[1])), heavyMs: summary(all.filter(s => s[1])),
    generatorLagMs: summary(reports.flatMap(r => r.lags).map(ms => [ms])),
    drainMs: Math.max(...reports.map(r => r.drainMs)), histogram }))
} else {
  const o = workerData
  const clients = o.clients || 4
  const concurrency = Math.max(1, Math.floor((o.concurrency || 64) / clients))
  const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency, maxFreeSockets: concurrency })
  const session = o.protocol === 'h2' ? http2.connect('http://watt-multi-server:3000') : null
  session?.on('error', () => {})
  let random = ((o.seed || 1) * 7919 + o.index * 104729) >>> 0
  function rng () { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296 }
  const samples = [], errors = [], lags = []
  let scheduled = 0, pending = 0
  function request (due) {
    const heavy = (o.workload === 'cpu' || o.workload === 'async') && rng() >= .6
    const path = o.workload === 'cpu' ? `/cpu?n=${heavy ? Math.round(o.heavyN * (.4 + 1.2 * rng())) : o.lightN}` : o.workload === 'async' ? `/async?ms=${heavy ? 100 + Math.floor(rng() * 300) : 1}` : '/' + o.workload
    scheduled++; pending++; lags.push(performance.now() - due)
    return new Promise(resolve => {
      let bytes = 0, worker = -1, status, done = false
      const finish = error => {
        if (done) return; done = true; pending--
        if (error) errors.push(String(error))
        else if (status !== 200 || bytes !== (o.workload === 'bytes' ? 65536 : 2) || worker < 0 || worker > 3) errors.push(`invalid response status=${status} bytes=${bytes} worker=${worker}`)
        else samples.push([performance.now() - due, heavy ? 1 : 0, worker, performance.now() - start])
        resolve()
      }
      let stream
      if (session) {
        stream = session.request({ ':path': path, ':method': 'GET' })
        stream.on('response', headers => { status = headers[':status']; worker = Number(headers['x-bench-worker']) })
        stream.on('data', b => { bytes += b.length }); stream.on('end', () => finish()); stream.end()
      } else {
        stream = http.get({ hostname: 'watt-multi-server', port: 3000, path, agent }, res => {
          status = res.statusCode; worker = Number(res.headers['x-bench-worker'])
          res.on('data', b => { bytes += b.length }); res.on('end', () => finish()); res.on('error', finish)
        })
      }
      stream.on('error', finish)
      stream.setTimeout(30000, () => { stream.destroy(); finish('timeout') })
    })
  }
  // A common future start prevents startup skew between generator threads.
  const delay = Math.max(0, (o.startAt || Date.now() + 200) - Date.now())
  await new Promise(r => setTimeout(r, delay))
  const start = performance.now(), end = start + o.seconds * 1000
  if (o.rate) {
    const requests = Math.round(o.rate * o.seconds)
    for (let i = o.index; i < requests; i += clients) {
      const due = start + i * 1000 / o.rate
      if (performance.now() < due) await new Promise(r => setTimeout(r, due - performance.now()))
      // Open-loop: queued time is included from due, so overload is not hidden by backpressure.
      request(due)
    }
    while (pending) await new Promise(r => setTimeout(r, 5))
  } else {
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (performance.now() < end) await request(performance.now())
    }))
  }
  agent.destroy(); session?.close()
  parentPort.postMessage({ scheduled, samples, errors, lags, drainMs: Math.max(0, performance.now() - end) })
}
