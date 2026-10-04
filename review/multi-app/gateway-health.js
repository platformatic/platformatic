// Benchmark instrumentation only; production reservations need no app hooks.
import { workerData, threadId, BroadcastChannel } from 'node:worker_threads'
import { performance, monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks'
import { getHeapStatistics } from 'node:v8'
export default async function gatewayHealth (app) {
  const channel = new BroadcastChannel('watt.multi-app.health')
  const delay = monitorEventLoopDelay({ resolution: 10 }); delay.enable()
  let running = 0, served = 0, aborted = 0, gcCount = 0, gcMs = 0
  let previous = performance.eventLoopUtilization()
  const observer = new PerformanceObserver(list => { for (const e of list.getEntries()) { gcCount++; gcMs += e.duration } })
  observer.observe({ entryTypes: ['gc'] })
  app.addHook('onRequest', async (req, reply) => {
    running++
    reply.header('x-bench-gateway', String(workerData.worker.index))
    const ended = () => {
      reply.raw.off('finish', ended); reply.raw.off('close', ended)
      running--; if (reply.raw.writableFinished) served++; else aborted++
    }
    reply.raw.once('finish', ended); reply.raw.once('close', ended)
  })
  const timer = setInterval(() => {
    const current = performance.eventLoopUtilization()
    const elu = performance.eventLoopUtilization(current, previous).utilization; previous = current
    const memory = process.memoryUsage(), heap = getHeapStatistics()
    channel.postMessage({ at: Date.now(), app: 'gateway', index: workerData.worker.index, threadId,
      served, aborted, running, allocations: 0, gcCount, gcMs, elu, heapUsed: memory.heapUsed,
      heapLimit: heap.heap_size_limit, external: memory.external, arrayBuffers: memory.arrayBuffers,
      loopP99Ms: delay.percentile(99) / 1e6, routing: null })
    delay.reset()
  }, 250)
  app.addHook('onClose', async () => { clearInterval(timer); observer.disconnect(); delay.disable(); channel.close() })
}
