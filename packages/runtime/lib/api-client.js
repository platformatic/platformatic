'use strict'

const { once, EventEmitter } = require('node:events')
const { randomUUID } = require('node:crypto')
const errors = require('./errors')
const { setTimeout: sleep } = require('node:timers/promises')

const MAX_LISTENERS_COUNT = 100
const MAX_METRICS_QUEUE_LENGTH = 5 * 60 // 5 minutes in seconds
const COLLECT_METRICS_TIMEOUT = 1000

class RuntimeApiClient extends EventEmitter {
  #exitCode
  #exitPromise
  #metrics
  #metricsTimeout

  constructor (worker) {
    super()
    this.setMaxListeners(MAX_LISTENERS_COUNT)

    this.worker = worker
    this.#exitPromise = this.#exitHandler()
    this.worker.on('message', (message) => {
      if (message.operationId) {
        this.emit(message.operationId, message)
      }
    })
  }

  async start () {
    const address = await this.#sendCommand('plt:start-services')
    this.emit('start', address)
    return address
  }

  async close () {
    await this.#sendCommand('plt:stop-services')

    this.worker.postMessage({ command: 'plt:close' })
    const res = await Promise.race([
      this.#exitPromise,
      // We must kill the worker if it doesn't exit in 10 seconds
      // because it may be stuck in an infinite loop.
      // This is a workaround for
      // https://github.com/nodejs/node/issues/47748
      // https://github.com/nodejs/node/issues/49344
      // Remove once https://github.com/nodejs/node/pull/51290 is released
      // on all lines.
      // Likely to be removed when we drop support for Node.js 18.
      sleep(10000, 'timeout', { ref: false })
    ])

    if (res === 'timeout') {
      this.worker.unref()
    }
  }

  async restart () {
    return this.#sendCommand('plt:restart-services')
  }

  async getEntrypointDetails () {
    return this.#sendCommand('plt:get-entrypoint-details')
  }

  async getServices () {
    return this.#sendCommand('plt:get-services')
  }

  async getServiceDetails (id) {
    return this.#sendCommand('plt:get-service-details', { id })
  }

  async getServiceConfig (id) {
    return this.#sendCommand('plt:get-service-config', { id })
  }

  async getServiceOpenapiSchema (id) {
    return this.#sendCommand('plt:get-service-openapi-schema', { id })
  }

  async getServiceGraphqlSchema (id) {
    return this.#sendCommand('plt:get-service-graphql-schema', { id })
  }

  async getMetrics (format = 'json') {
    return this.#sendCommand('plt:get-metrics', { format })
  }

  async startService (id) {
    return this.#sendCommand('plt:start-service', { id })
  }

  async stopService (id) {
    return this.#sendCommand('plt:stop-service', { id })
  }

  async inject (id, injectParams) {
    return this.#sendCommand('plt:inject', { id, injectParams })
  }

  getCachedMetrics () {
    return this.#metrics
  }

  async getFormattedMetrics () {
    const { metrics } = await this.getMetrics()

    const entrypointDetails = await this.getEntrypointDetails()
    const entrypointConfig = await this.getServiceConfig(entrypointDetails.id)
    const entrypointMetricsPrefix = entrypointConfig.metrics?.prefix

    const cpuMetric = metrics.find(
      (metric) => metric.name === 'process_cpu_percent_usage'
    )
    const rssMetric = metrics.find(
      (metric) => metric.name === 'process_resident_memory_bytes'
    )
    const totalHeapSizeMetric = metrics.find(
      (metric) => metric.name === 'nodejs_heap_size_total_bytes'
    )
    const usedHeapSizeMetric = metrics.find(
      (metric) => metric.name === 'nodejs_heap_size_used_bytes'
    )
    const heapSpaceSizeTotalMetric = metrics.find(
      (metric) => metric.name === 'nodejs_heap_space_size_total_bytes'
    )
    const newSpaceSizeTotalMetric = heapSpaceSizeTotalMetric.values.find(
      (value) => value.labels.space === 'new'
    )
    const oldSpaceSizeTotalMetric = heapSpaceSizeTotalMetric.values.find(
      (value) => value.labels.space === 'old'
    )
    const eventLoopUtilizationMetric = metrics.find(
      (metric) => metric.name === 'nodejs_eventloop_utilization'
    )

    let p50Value = 0
    let p90Value = 0
    let p95Value = 0
    let p99Value = 0

    if (entrypointMetricsPrefix) {
      const metricName = entrypointMetricsPrefix + 'http_request_all_summary_seconds'
      const httpLatencyMetrics = metrics.find((metric) => metric.name === metricName)

      p50Value = httpLatencyMetrics.values.find(
        (value) => value.labels.quantile === 0.5
      ).value || 0
      p90Value = httpLatencyMetrics.values.find(
        (value) => value.labels.quantile === 0.9
      ).value || 0
      p95Value = httpLatencyMetrics.values.find(
        (value) => value.labels.quantile === 0.95
      ).value || 0
      p99Value = httpLatencyMetrics.values.find(
        (value) => value.labels.quantile === 0.99
      ).value || 0

      p50Value = Math.round(p50Value * 1000)
      p90Value = Math.round(p90Value * 1000)
      p95Value = Math.round(p95Value * 1000)
      p99Value = Math.round(p99Value * 1000)
    }

    const cpu = cpuMetric.values[0].value
    const rss = rssMetric.values[0].value
    const elu = eventLoopUtilizationMetric.values[0].value
    const totalHeapSize = totalHeapSizeMetric.values[0].value
    const usedHeapSize = usedHeapSizeMetric.values[0].value
    const newSpaceSize = newSpaceSizeTotalMetric.value
    const oldSpaceSize = oldSpaceSizeTotalMetric.value

    const formattedMetrics = {
      version: 1,
      date: new Date().toISOString(),
      cpu,
      elu,
      rss,
      totalHeapSize,
      usedHeapSize,
      newSpaceSize,
      oldSpaceSize,
      entrypoint: {
        latency: {
          p50: p50Value,
          p90: p90Value,
          p95: p95Value,
          p99: p99Value
        }
      }
    }
    return formattedMetrics
  }

  startCollectingMetrics () {
    this.#metrics = []
    this.#metricsTimeout = setInterval(async () => {
      let metrics = null
      try {
        metrics = await this.getFormattedMetrics()
      } catch (error) {
        if (!(error instanceof errors.RuntimeExitedError)) {
          console.error('Error collecting metrics', error)
        }
        return
      }

      this.emit('metrics', metrics)
      this.#metrics.push(metrics)
      if (this.#metrics.length > MAX_METRICS_QUEUE_LENGTH) {
        this.#metrics.shift()
      }
    }, COLLECT_METRICS_TIMEOUT).unref()
  }

  async #sendCommand (command, params = {}) {
    const operationId = randomUUID()

    this.worker.postMessage({ operationId, command, params })
    const [message] = await Promise.race(
      [once(this, operationId), this.#exitPromise]
    )

    if (this.#exitCode !== undefined) {
      throw new errors.RuntimeExitedError()
    }

    const { error, data } = message
    if (error !== null) {
      throw new Error(error)
    }

    return JSON.parse(data)
  }

  async #exitHandler () {
    this.#exitCode = undefined
    return once(this.worker, 'exit').then((msg) => {
      clearInterval(this.#metricsTimeout)
      this.#exitCode = msg[0]
      this.emit('close')
      return msg
    })
  }
}

module.exports = RuntimeApiClient
