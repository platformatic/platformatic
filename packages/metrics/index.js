'use strict'

const os = require('node:os')
const { eventLoopUtilization } = require('node:perf_hooks').performance
const client = require('prom-client')
const collectHttpMetrics = require('@platformatic/http-metrics')
const httpMetrics = require('./http-metrics')

const { Registry, Gauge, Counter, collectDefaultMetrics } = client

async function collectMetrics (serviceId, workerId, metricsConfig = {}, registry = undefined) {
  if (!registry) {
    registry = new Registry()
  }

  const httpRequestCallbacks = []
  const httpResponseCallbacks = []

  const labels = { ...metricsConfig.labels, serviceId }
  if (workerId >= 0) {
    labels.workerId = workerId
  }
  registry.setDefaultLabels(labels)

  if (metricsConfig.defaultMetrics) {
    collectDefaultMetrics({ register: registry })
    collectEluMetric(registry)
    await collectThreadCpuMetrics(registry)
  }

  if (metricsConfig.httpMetrics) {
    {
      const { startTimer, endTimer } = collectHttpMetrics(registry, {
        customLabels: ['telemetry_id'],
        getCustomLabels: req => {
          const telemetryId = req.headers?.['x-plt-telemetry-id'] ?? 'unknown'
          return { telemetry_id: telemetryId }
        }
      })
      httpRequestCallbacks.push(startTimer)
      httpResponseCallbacks.push(endTimer)
    }

    {
      // TODO: check if it's a nodejs environment
      // Needed for the Meraki metrics
      const { startTimer, endTimer } = collectHttpMetrics(registry, {
        customLabels: ['telemetry_id'],
        getCustomLabels: req => {
          const telemetryId = req.headers?.['x-plt-telemetry-id'] ?? 'unknown'
          return { telemetry_id: telemetryId }
        },
        histogram: {
          name: 'http_request_all_duration_seconds',
          help: 'request duration in seconds summary for all requests',
          collect: function () {
            process.nextTick(() => this.reset())
          }
        },
        summary: {
          name: 'http_request_all_summary_seconds',
          help: 'request duration in seconds histogram for all requests',
          collect: function () {
            process.nextTick(() => this.reset())
          }
        }
      })
      httpRequestCallbacks.push(startTimer)
      httpResponseCallbacks.push(endTimer)
    }
  }

  return {
    registry,
    startHttpTimer: options => httpRequestCallbacks.forEach(cb => cb(options)),
    endHttpTimer: options => httpResponseCallbacks.forEach(cb => cb(options))
  }
}

async function collectThreadCpuMetrics (registry) {
  let threadCpuUsage

  try {
    // We need until we switch to 22 as thread-cpu-usage is ESM
    const res = await import('thread-cpu-usage')
    threadCpuUsage = res.threadCpuUsage
  } catch {
    process.emitWarning('thread-cpu-usage not available')
    // We ignore the loading error, as this might
    // happen if the library has failed to compile
    // on this platform.
    return
  }

  let lastSample = process.hrtime.bigint()
  let lastUsage = threadCpuUsage()

  const threadCpuUserUsageCounterMetric = new Counter({
    name: 'thread_cpu_user_system_seconds_total',
    help: 'Total user CPU time spent in seconds for the current thread.',
    registers: [registry]
  })

  const threadCpuSystemUsageCounterMetric = new Counter({
    name: 'thread_cpu_system_seconds_total',
    help: 'Total system CPU time spent in seconds for the current thread.',
    registers: [registry]
  })

  const threadCpuPercentUsageGaugeMetric = new Gauge({
    name: 'thread_cpu_percent_usage',
    help: 'The thread CPU percent usage.',
    registers: [registry]
  })

  const threadCpuUsageCounterMetric = new Counter({
    name: 'thread_cpu_seconds_total',
    help: 'Total user and system CPU time spent in seconds for the current threads.',
    // Use this one metric's `collect` to set all metrics' values.
    collect () {
      const newSample = process.hrtime.bigint()
      const newUsage = threadCpuUsage()
      const user = newUsage.user - lastUsage.user
      const system = newUsage.system - lastUsage.system
      const elapsed = Number(newSample - lastSample)

      lastUsage = newUsage
      lastSample = newSample

      threadCpuSystemUsageCounterMetric.inc(system / 1e6)
      threadCpuUserUsageCounterMetric.inc(user / 1e6)
      threadCpuUsageCounterMetric.inc((user + system) / 1e6)
      threadCpuPercentUsageGaugeMetric.set((100 * ((user + system) * 1000)) / elapsed)
    },
    registers: [registry]
  })

  registry.registerMetric(threadCpuUserUsageCounterMetric)
  registry.registerMetric(threadCpuSystemUsageCounterMetric)
  registry.registerMetric(threadCpuUsageCounterMetric)
  registry.registerMetric(threadCpuPercentUsageGaugeMetric)
}

function collectEluMetric (register) {
  let startELU = eventLoopUtilization()
  const eluMetric = new Gauge({
    name: 'nodejs_eventloop_utilization',
    help: 'The event loop utilization as a fraction of the loop time. 1 is fully utilized, 0 is fully idle.',
    collect: () => {
      const endELU = eventLoopUtilization()
      const result = eventLoopUtilization(endELU, startELU).utilization
      eluMetric.set(result)
      startELU = endELU
    },
    registers: [register]
  })
  register.registerMetric(eluMetric)

  let previousIdleTime = 0
  let previousTotalTime = 0
  const cpuMetric = new Gauge({
    name: 'process_cpu_percent_usage',
    help: 'The process CPU percent usage.',
    collect: () => {
      const cpus = os.cpus()
      let idleTime = 0
      let totalTime = 0

      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTime += cpu.times[type]
          if (type === 'idle') {
            idleTime += cpu.times[type]
          }
        }
      })

      const idleDiff = idleTime - previousIdleTime
      const totalDiff = totalTime - previousTotalTime

      const usagePercent = 100 - (100 * idleDiff) / totalDiff
      const roundedUsage = Math.round(usagePercent * 100) / 100
      cpuMetric.set(roundedUsage)

      previousIdleTime = idleTime
      previousTotalTime = totalTime
    },
    registers: [register]
  })
  register.registerMetric(cpuMetric)
}

module.exports = { collectMetrics, client, httpMetrics }
