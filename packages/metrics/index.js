import collectHttpMetrics from '@platformatic/http-metrics'
import { subscribe, unsubscribe } from 'node:diagnostics_channel'
import os from 'node:os'
import { performance } from 'node:perf_hooks'
import client from '@platformatic/prom-client'

// Import individual metric collectors from prom-client
import processCpuTotal from '@platformatic/prom-client/lib/metrics/processCpuTotal.js'
import processStartTime from '@platformatic/prom-client/lib/metrics/processStartTime.js'
import osMemoryHeap from '@platformatic/prom-client/lib/metrics/osMemoryHeap.js'
import processOpenFileDescriptors from '@platformatic/prom-client/lib/metrics/processOpenFileDescriptors.js'
import processMaxFileDescriptors from '@platformatic/prom-client/lib/metrics/processMaxFileDescriptors.js'
import eventLoopLag from '@platformatic/prom-client/lib/metrics/eventLoopLag.js'
import processHandles from '@platformatic/prom-client/lib/metrics/processHandles.js'
import processRequests from '@platformatic/prom-client/lib/metrics/processRequests.js'
import processResources from '@platformatic/prom-client/lib/metrics/processResources.js'
import heapSizeAndUsed from '@platformatic/prom-client/lib/metrics/heapSizeAndUsed.js'
import heapSpacesSizeAndUsed from '@platformatic/prom-client/lib/metrics/heapSpacesSizeAndUsed.js'
import version from '@platformatic/prom-client/lib/metrics/version.js'
import gc from '@platformatic/prom-client/lib/metrics/gc.js'

export * as client from '@platformatic/prom-client'

const { eventLoopUtilization } = performance
const { Registry, Gauge, Counter, Histogram, collectDefaultMetrics } = client

export const kMetricsGroups = Symbol('plt.metrics.MetricsGroups')
const kMetricsCleanups = Symbol('plt.metrics.MetricsCleanups')
const kHttpClientRequestStart = Symbol('plt.metrics.HttpClientRequestStart')
const kHttpClientRequestStatusCode = Symbol('plt.metrics.HttpClientRequestStatusCode')

function getRegistrySet (registry, key) {
  registry[key] ??= new Set()
  return registry[key]
}

// Process-level metrics (same across all workers, collect once in main thread)
export const PROCESS_LEVEL_METRICS = [
  'process_cpu_user_seconds_total',
  'process_cpu_system_seconds_total',
  'process_cpu_seconds_total',
  'process_start_time_seconds',
  'process_resident_memory_bytes',
  'process_open_fds',
  'process_max_fds',
  'nodejs_version_info',
  'process_cpu_percent_usage'
]

// Thread/isolate-specific metrics (different per worker)
export const THREAD_LEVEL_METRICS = [
  'nodejs_heap_size_total_bytes',
  'nodejs_heap_size_used_bytes',
  'nodejs_external_memory_bytes',
  'nodejs_heap_space_size_total_bytes',
  'nodejs_heap_space_size_used_bytes',
  'nodejs_heap_space_size_available_bytes',
  'nodejs_eventloop_lag_seconds',
  'nodejs_eventloop_lag_min_seconds',
  'nodejs_eventloop_lag_max_seconds',
  'nodejs_eventloop_lag_mean_seconds',
  'nodejs_eventloop_lag_stddev_seconds',
  'nodejs_eventloop_lag_p50_seconds',
  'nodejs_eventloop_lag_p90_seconds',
  'nodejs_eventloop_lag_p99_seconds',
  'nodejs_eventloop_utilization',
  'nodejs_gc_duration_seconds',
  'nodejs_active_handles',
  'nodejs_active_handles_total',
  'nodejs_active_requests',
  'nodejs_active_requests_total',
  'nodejs_active_resources',
  'nodejs_active_resources_total',
  'thread_cpu_user_system_seconds_total',
  'thread_cpu_system_seconds_total',
  'thread_cpu_seconds_total',
  'thread_cpu_percent_usage'
]

export function registerMetricsGroup (registry, group) {
  getRegistrySet(registry, kMetricsGroups).add(group)
}

export function hasMetricsGroup (registry, group) {
  return registry[kMetricsGroups]?.has(group)
}

// Use this method when dealing with metrics registration in async functions.
// This will ensure that the group is registered only once.
export function ensureMetricsGroup (registry, group) {
  const groups = getRegistrySet(registry, kMetricsGroups)

  if (groups.has(group)) {
    return true
  }

  groups.add(group)
  return false
}

export function registerMetricsCleanup (registry, cleanup) {
  getRegistrySet(registry, kMetricsCleanups).add(cleanup)
}

export function clearRegistry (registry) {
  if (registry[kMetricsCleanups]) {
    for (const cleanup of registry[kMetricsCleanups]) {
      cleanup()
    }
    registry[kMetricsCleanups].clear()
  }

  registry.clear()
  if (registry[kMetricsGroups]) {
    registry[kMetricsGroups].clear()
  }
}

function getHttpClientRequestOrigin (request) {
  return typeof request.origin === 'string' && request.origin.length > 0 ? request.origin : 'unknown'
}

function getHttpClientErrorType (error) {
  return error ? String(error.code ?? error.name ?? 'unknown') : ''
}

export function collectHttpClientMetrics (registry) {
  if (ensureMetricsGroup(registry, 'http-client')) {
    return
  }

  const requestDurationMetric = new Histogram({
    name: 'http_client_request_duration_seconds',
    help: 'outgoing HTTP client request duration in seconds',
    labelNames: ['method', 'status_code', 'dispatcher_stats_url', 'error_type'],
    collect: function () {
      process.nextTick(() => this.reset())
    },
    registers: [registry]
  })

  const onRequestCreate = ({ request }) => {
    if (request && typeof request === 'object') {
      request[kHttpClientRequestStart] = performance.now()
    }
  }

  const onRequestHeaders = ({ request, response }) => {
    if (request && typeof request === 'object') {
      request[kHttpClientRequestStatusCode] = response?.statusCode ?? ''
    }
  }

  const observeRequest = ({ request, response, error }) => {
    if (!request || typeof request !== 'object') {
      return
    }

    const start = request[kHttpClientRequestStart]
    if (start === undefined) {
      return
    }

    const duration = (performance.now() - start) / 1000
    const method = request.method ?? 'unknown'
    const statusCode = response?.statusCode ?? request[kHttpClientRequestStatusCode] ?? ''
    const dispatcherStatsUrl = getHttpClientRequestOrigin(request)
    const errorType = getHttpClientErrorType(error)

    delete request[kHttpClientRequestStart]
    delete request[kHttpClientRequestStatusCode]

    requestDurationMetric.observe({
      method,
      status_code: statusCode,
      dispatcher_stats_url: dispatcherStatsUrl,
      error_type: errorType
    }, duration)
  }

  subscribe('undici:request:create', onRequestCreate)
  subscribe('undici:request:headers', onRequestHeaders)
  subscribe('undici:request:trailers', observeRequest)
  subscribe('undici:request:error', observeRequest)

  registerMetricsCleanup(registry, () => {
    unsubscribe('undici:request:create', onRequestCreate)
    unsubscribe('undici:request:headers', onRequestHeaders)
    unsubscribe('undici:request:trailers', observeRequest)
    unsubscribe('undici:request:error', observeRequest)
  })
}

function collectHttpServerMetrics (registry, metricsConfig) {
  if (ensureMetricsGroup(registry, 'http')) {
    return
  }

  // Build custom labels configuration
  const { customLabels, getCustomLabels } = buildCustomLabelsConfig(metricsConfig.httpCustomLabels)

  collectHttpMetrics(registry, {
    customLabels,
    getCustomLabels,
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
}

export async function collectThreadCpuMetrics (registry) {
  if (ensureMetricsGroup(registry, 'threadCpuUsage')) {
    return
  }

  let lastSample = process.hrtime.bigint()
  let lastUsage = process.threadCpuUsage()

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
      const newUsage = process.threadCpuUsage()
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

// Collect system CPU usage metric (based on os.cpus(), process-level)
export function collectSystemCpuMetric (registry) {
  if (ensureMetricsGroup(registry, 'systemCpu')) {
    return
  }

  let previousIdleTime = 0
  let previousTotalTime = 0
  const cpuMetric = new Gauge({
    name: 'process_cpu_percent_usage',
    help: 'The process CPU percent usage.',
    collect: () => {
      const cpus = os.cpus()
      let idleTime = 0
      let totalTime = 0

      for (let i = 0; i < cpus.length; i++) {
        const cpu = cpus[i]
        const times = cpu.times
        for (const type in times) {
          totalTime += times[type]
          if (type === 'idle') {
            idleTime += times[type]
          }
        }
      }

      const idleDiff = idleTime - previousIdleTime
      const totalDiff = totalTime - previousTotalTime

      const usagePercent = 100 - (100 * idleDiff) / totalDiff
      const roundedUsage = Math.round(usagePercent * 100) / 100
      cpuMetric.set(roundedUsage)

      previousIdleTime = idleTime
      previousTotalTime = totalTime
    },
    registers: [registry]
  })
  registry.registerMetric(cpuMetric)
}

// Collect only the ELU metric (thread-specific)
export function collectEluMetric (registry) {
  if (ensureMetricsGroup(registry, 'elu')) {
    return
  }

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
    registers: [registry]
  })
  registry.registerMetric(eluMetric)
}

// Legacy function that collects both ELU and system CPU (for backward compatibility)
export function collectEluAndSystemCpuMetrics (registry) {
  collectEluMetric(registry)
  collectSystemCpuMetric(registry)
}

// Collect process-level metrics (same across all workers, should run in main thread only)
export function collectProcessMetrics (registry) {
  if (ensureMetricsGroup(registry, 'process-level')) {
    return
  }

  const config = {}

  // Process CPU metrics
  processCpuTotal(registry, config)
  // Process start time
  processStartTime(registry, config)
  // Resident memory (RSS)
  osMemoryHeap(registry, config)
  // Open file descriptors (Linux)
  processOpenFileDescriptors(registry, config)
  // Max file descriptors (Linux)
  processMaxFileDescriptors(registry, config)
  // Node.js version info
  version(registry, config)
  // System CPU percent usage (os.cpus() based)
  collectSystemCpuMetric(registry)
}

// Collect thread-specific metrics (different per worker)
export async function collectThreadMetrics (applicationId, workerId, metricsConfig = {}, registry = undefined) {
  if (!registry) {
    registry = new Registry()
  }

  const labels = { ...metricsConfig.labels }

  // Use the configured label name
  const labelName = metricsConfig.idLabel || 'applicationId'
  labels[labelName] = applicationId

  if (workerId >= 0) {
    labels.workerId = workerId
  }
  registry.setDefaultLabels(labels)

  if (metricsConfig.defaultMetrics) {
    if (!ensureMetricsGroup(registry, 'thread-level')) {
      const config = { eventLoopMonitoringPrecision: 10 }

      // Thread-specific metrics only
      heapSizeAndUsed(registry, config)
      heapSpacesSizeAndUsed(registry, config)
      eventLoopLag(registry, config)
      gc(registry, config)
      processHandles(registry, config)
      processRequests(registry, config)
      if (typeof process.getActiveResourcesInfo === 'function') {
        processResources(registry, config)
      }
    }

    // Event loop utilization (thread-specific)
    collectEluMetric(registry)
    // Thread CPU metrics
    await collectThreadCpuMetrics(registry)
  }

  if (metricsConfig.httpMetrics) {
    collectHttpServerMetrics(registry, metricsConfig)
    collectHttpClientMetrics(registry)
  }

  return {
    registry,
    otlpBridge: null
  }
}

// Build custom labels configuration from metrics config
// Returns { customLabels: string[], getCustomLabels: (req) => object }
export function buildCustomLabelsConfig (customLabelsConfig) {
  if (!customLabelsConfig || customLabelsConfig.length === 0) {
    return {
      customLabels: [],
      getCustomLabels: () => ({})
    }
  }

  // Build custom labels from configuration
  const customLabels = customLabelsConfig.map(label => label.name)

  const getCustomLabels = req => {
    const labels = {}
    for (const labelConfig of customLabelsConfig) {
      const headerValue = req.headers?.[labelConfig.header.toLowerCase()]
      labels[labelConfig.name] = headerValue ?? labelConfig.default ?? 'unknown'
    }
    return labels
  }

  return { customLabels, getCustomLabels }
}

// Original function for backward compatibility (collects all metrics)
export async function collectMetrics (applicationId, workerId, metricsConfig = {}, registry = undefined) {
  if (!registry) {
    registry = new Registry()
  }

  const labels = { ...metricsConfig.labels }

  // Use the configured label name
  const labelName = metricsConfig.idLabel || 'applicationId'
  labels[labelName] = applicationId

  if (workerId >= 0) {
    labels.workerId = workerId
  }
  registry.setDefaultLabels(labels)

  if (metricsConfig.defaultMetrics) {
    if (!ensureMetricsGroup(registry, 'default')) {
      collectDefaultMetrics({ register: registry })
    }

    collectEluMetric(registry)
    collectSystemCpuMetric(registry)
    await collectThreadCpuMetrics(registry)
  }

  if (metricsConfig.httpMetrics) {
    collectHttpServerMetrics(registry, metricsConfig)
    collectHttpClientMetrics(registry)
  }

  return {
    registry,
    otlpBridge: null
  }
}

export async function setupOtlpExporter (registry, otlpExporterConfig, applicationId) {
  if (!otlpExporterConfig || !otlpExporterConfig.endpoint) {
    return null
  }

  // Check if explicitly disabled
  if (otlpExporterConfig.enabled === false || otlpExporterConfig.enabled === 'false') {
    return null
  }

  // Dynamically import PromClientBridge to defer loading until after telemetry is initialized
  const { PromClientBridge } = await import('@platformatic/promotel')

  const {
    endpoint,
    headers,
    interval = 60000,
    serviceName = applicationId,
    serviceVersion
  } = otlpExporterConfig

  const otlpEndpointOptions = {
    url: endpoint
  }

  if (headers) {
    otlpEndpointOptions.headers = headers
  }

  const conversionOptions = {
    serviceName
  }

  if (serviceVersion) {
    conversionOptions.serviceVersion = serviceVersion
  }

  const bridge = new PromClientBridge({
    registry,
    otlpEndpoint: otlpEndpointOptions,
    interval,
    conversionOptions,
    onError: (error) => {
      // Log error but don't crash the application
      console.error('OTLP metrics export error:', error)
    }
  })

  return bridge
}
