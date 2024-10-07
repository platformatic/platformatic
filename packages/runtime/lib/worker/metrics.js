'use strict'

const os = require('node:os')
const { eventLoopUtilization } = require('node:perf_hooks').performance
const { Registry, Gauge, collectDefaultMetrics } = require('prom-client')
const collectHttpMetrics = require('@platformatic/http-metrics')

async function collectMetrics (stackable, serviceId, opts = {}) {
  const registry = new Registry()

  const httpRequestCallbacks = []
  const httpResponseCallbacks = []

  const metricsConfig = await stackable.collectMetrics({
    registry,
    startHttpTimer: options => httpRequestCallbacks.forEach(cb => cb(options)),
    endHttpTimer: options => httpResponseCallbacks.forEach(cb => cb(options))
  })

  const labels = opts.labels ?? {}
  registry.setDefaultLabels({ ...labels, serviceId })

  if (metricsConfig.defaultMetrics) {
    collectDefaultMetrics({ register: registry })
    collectEluMetric(registry)
  }

  if (metricsConfig.httpMetrics) {
    {
      const { startTimer, endTimer } = collectHttpMetrics(registry, {
        customLabels: ['telemetry_id'],
        getCustomLabels: (req) => {
          const telemetryId = req.headers['x-plt-telemetry-id'] ?? 'unknown'
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
        getCustomLabels: (req) => {
          const telemetryId = req.headers['x-plt-telemetry-id'] ?? 'unknown'
          return { telemetry_id: telemetryId }
        },
        histogram: {
          name: 'http_request_all_duration_seconds',
          help: 'request duration in seconds summary for all requests',
          collect: function () {
            process.nextTick(() => this.reset())
          },
        },
        summary: {
          name: 'http_request_all_summary_seconds',
          help: 'request duration in seconds histogram for all requests',
          collect: function () {
            process.nextTick(() => this.reset())
          },
        },
      })
      httpRequestCallbacks.push(startTimer)
      httpResponseCallbacks.push(endTimer)
    }
  }

  return registry
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
    registers: [register],
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

      const usagePercent = 100 - ((100 * idleDiff) / totalDiff)
      const roundedUsage = Math.round(usagePercent * 100) / 100
      cpuMetric.set(roundedUsage)

      previousIdleTime = idleTime
      previousTotalTime = totalTime
    },
    registers: [register],
  })
  register.registerMetric(cpuMetric)
}

module.exports = { collectMetrics }
