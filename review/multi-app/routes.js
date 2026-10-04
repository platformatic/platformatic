import { workerData, threadId, BroadcastChannel } from 'node:worker_threads'
import { performance, monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks'
import { getHeapStatistics } from 'node:v8'
import { pbkdf2Sync } from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const routing = require('@platformatic/runtime/lib/mesh/lib/request-routing.js')
const id = workerData.applicationConfig.id
const index = workerData.worker.index
const state = workerData.requestRouting
if (state && process.env.MULTI_POLICY === 'pressure') state.algorithm = 'pressure'
const channel = new BroadcastChannel('watt.multi-app.health')
const delay = monitorEventLoopDelay({ resolution: 10 })
delay.enable()
let served = 0, running = 0, allocations = 0, gcCount = 0, gcMs = 0
let previous = performance.eventLoopUtilization()
const observer = new PerformanceObserver(list => { for (const e of list.getEntries()) { gcCount++; gcMs += e.duration } })
observer.observe({ entryTypes: ['gc'] })
const live = []
function allocate (count) {
  const a = Array.from({ length: count }, (_, i) => ({ i, text: `${id}-${i}-${allocations}`, values: [i, i + 1, i + 2, i + 3] }))
  allocations += count
  return a
}
const mb = id === 'catalog' ? 1 : id === 'rendering' ? 8 : id === 'search' ? (index ? 128 : 32) : (index ? 80 : 32)
const baseline = process.memoryUsage().heapUsed
while (process.memoryUsage().heapUsed - baseline < mb * 1048576) live.push(allocate(10000))
const cpu = n => pbkdf2Sync('multi-app', 'fixed-seed', n, 16, 'sha256')
let churn = []
const timers = []
if (process.env.MULTI_HOTSPOTS !== '0' && index === 0 && ['rendering', 'personalization'].includes(id)) {
  const ms = id === 'rendering' ? 75 : 40
  // Duty-cycle CPU work exists independently of routed requests.
  timers.push(setInterval(() => { const until = performance.now() + ms; while (performance.now() < until) cpu(1000) }, 90))
}
timers.push(setInterval(() => {
  const current = performance.eventLoopUtilization()
  const elu = performance.eventLoopUtilization(current, previous).utilization
  previous = current
  const memory = process.memoryUsage(), heap = getHeapStatistics()
  if (state) routing.recordHealth(state, elu, memory.heapUsed / heap.heap_size_limit)
  channel.postMessage({ at: Date.now(), app: id, index, threadId, served, running, allocations, gcCount, gcMs,
    elu, heapUsed: memory.heapUsed, heapLimit: heap.heap_size_limit, external: memory.external,
    arrayBuffers: memory.arrayBuffers, loopP99Ms: delay.percentile(99) / 1e6,
    routing: state ? routing.snapshot(state) : null })
  delay.reset()
}, 250))
export default async function routes (app) {
  app.decorate('benchmarkLiveSet', live)
  app.addHook('onClose', async () => { timers.forEach(clearInterval); observer.disconnect(); delay.disable(); channel.close() })
  app.addHook('onRequest', async (req, reply) => { running++; reply.header('x-app', id); reply.header('x-worker', String(index)) })
  app.addHook('onResponse', async () => { running--; served++ })
  app.get('/work', async req => {
    const n = Number(req.query.n) || 1000
    if (id === 'rendering' || id === 'personalization') cpu(n)
    if (id === 'search' || id === 'personalization') { churn.push(allocate(id === 'search' ? 12000 : 8000)); if (churn.length > 3) churn.shift() }
    if (id === 'catalog' || id === 'search') await new Promise(resolve => setTimeout(resolve, 1))
    return { app: id, worker: index, request: req.query.rid }
  })
}
