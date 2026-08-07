import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import getPort from 'get-port'
import { Client, request } from 'undici'
import { transform } from '../index.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

function cleanExtensionGlobals () {
  globalThis.__pltExtensionEvents = []
  globalThis.__pltExtensionMetricsRegistries = []
}

function countMetricFamilies (metrics, name) {
  return metrics.filter(metric => metric.name === name).length
}

function countTextMetricSamples (text, name) {
  return text
    .split('\n')
    .filter(line => line.startsWith(`${name}{`) || line.startsWith(`${name} `))
    .length
}

function countHelpBlocks (text, name) {
  return text
    .split('\n')
    .filter(line => line.startsWith(`# HELP ${name} `))
    .length
}

function countTypeBlocks (text, name) {
  return text
    .split('\n')
    .filter(line => line.startsWith(`# TYPE ${name} `))
    .length
}

test('extension metrics appear once in JSON and text output', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const port = await getPort()
  const configFile = join(fixturesDir, 'extensions', 'platformatic-metrics.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.metrics = { ...config.metrics, port }
      return config
    }
  })
  await app.start()

  t.after(() => app.close())

  const { metrics: jsonMetrics } = await app.getMetrics('json')
  strictEqual(countMetricFamilies(jsonMetrics, 'extension_jobs_total'), 1)

  const jobs = jsonMetrics.find(metric => metric.name === 'extension_jobs_total')
  ok(jobs)
  strictEqual(jobs.type, 'gauge')
  strictEqual(jobs.values.length, 1)
  strictEqual(jobs.values[0].value, 7)
  // Static labels from metrics.labels are applied; no worker/application ID is invented
  deepStrictEqual(jobs.values[0].labels, { env: 'test' })
  strictEqual(jobs.values[0].labels.workerId, undefined)
  strictEqual(jobs.values[0].labels.applicationId, undefined)

  const { metrics: textMetrics } = await app.getMetrics('text')
  strictEqual(countHelpBlocks(textMetrics, 'extension_jobs_total'), 1)
  strictEqual(countTypeBlocks(textMetrics, 'extension_jobs_total'), 1)
  strictEqual(countTextMetricSamples(textMetrics, 'extension_jobs_total'), 1)
  ok(textMetrics.includes('extension_jobs_total{env="test"} 7'))

  // Prometheus /metrics endpoint
  const { statusCode, body } = await request(`http://127.0.0.1:${port}/metrics`)
  strictEqual(statusCode, 200)
  const endpointText = await body.text()
  strictEqual(countHelpBlocks(endpointText, 'extension_jobs_total'), 1)
  strictEqual(countTextMetricSamples(endpointText, 'extension_jobs_total'), 1)

  // Management API
  const client = new Client(
    { hostname: 'localhost', protocol: 'http:' },
    { socketPath: app.getManagementApiUrl(), keepAliveTimeout: 10, keepAliveMaxTimeout: 10 }
  )
  t.after(() => client.close())

  const managementResponse = await client.request({ path: '/api/v1/metrics', method: 'GET' })
  strictEqual(managementResponse.statusCode, 200)
  const managementText = await managementResponse.body.text()
  strictEqual(countTextMetricSamples(managementText, 'extension_jobs_total'), 1)
})

test('multiple extension registries contribute distinct metrics', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-metrics-multi.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(() => app.close())

  const { metrics } = await app.getMetrics('json')
  strictEqual(countMetricFamilies(metrics, 'extension_jobs_total'), 1)
  strictEqual(countMetricFamilies(metrics, 'extension_events_total'), 1)

  const jobs = metrics.find(metric => metric.name === 'extension_jobs_total')
  const events = metrics.find(metric => metric.name === 'extension_events_total')
  strictEqual(jobs.values[0].value, 7)
  strictEqual(events.values[0].value, 3)

  const { metrics: text } = await app.getMetrics('text')
  strictEqual(countHelpBlocks(text, 'extension_jobs_total'), 1)
  strictEqual(countHelpBlocks(text, 'extension_events_total'), 1)
  strictEqual(countTextMetricSamples(text, 'extension_jobs_total'), 1)
  strictEqual(countTextMetricSamples(text, 'extension_events_total'), 1)
})

test('extension metrics are not duplicated across multiple application workers', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-metrics-workers.json')
  const app = await createRuntime(configFile, null, { isProduction: true })
  await app.start()

  t.after(() => app.close())

  const workers = await app.getWorkers()
  const workerCount = Object.keys(workers).length
  ok(workerCount > 1, `expected multiple workers, got ${workerCount}`)

  const { metrics: jsonMetrics } = await app.getMetrics('json')
  strictEqual(countMetricFamilies(jsonMetrics, 'extension_jobs_total'), 1)
  strictEqual(jsonMetrics.find(m => m.name === 'extension_jobs_total').values.length, 1)

  const { metrics: textMetrics } = await app.getMetrics('text')
  strictEqual(countHelpBlocks(textMetrics, 'extension_jobs_total'), 1)
  strictEqual(countTypeBlocks(textMetrics, 'extension_jobs_total'), 1)
  strictEqual(countTextMetricSamples(textMetrics, 'extension_jobs_total'), 1)

  // Process metrics remain reported once (not per worker / extension)
  strictEqual(countMetricFamilies(jsonMetrics, 'process_resident_memory_bytes'), 1)
  strictEqual(countHelpBlocks(textMetrics, 'process_resident_memory_bytes'), 1)
  strictEqual(countTextMetricSamples(textMetrics, 'process_resident_memory_bytes'), 1)
})

test('metric-family collisions between extensions fail with a coded error', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-metrics-collision.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(() => app.close())

  await rejects(
    () => app.getMetrics('json'),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_METRIC_FAMILY_COLLISION')
      ok(err.message.includes('extension_jobs_total'))
      ok(err.message.includes('extension-metrics-collision.js'))
      ok(err.message.includes('extension-metrics-1.js'))
      return true
    }
  )
})

test('metric-family collisions with process metrics fail with a coded error', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-metrics-process-collision.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(() => app.close())

  await rejects(
    () => app.getMetrics('json'),
    err => {
      strictEqual(err.code, 'PLT_RUNTIME_METRIC_FAMILY_COLLISION')
      ok(err.message.includes('process_resident_memory_bytes'))
      ok(err.message.includes('runtime process metrics'))
      ok(err.message.includes('extension-metrics-process-collision.js'))
      return true
    }
  )
})

test('extension metrics registries are cleared after close', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-metrics-multi.json')
  const app = await createRuntime(configFile)
  await app.start()

  const { metrics: beforeClose } = await app.getMetrics('json')
  ok(beforeClose.some(metric => metric.name === 'extension_jobs_total'))
  ok(beforeClose.some(metric => metric.name === 'extension_events_total'))

  const registries = globalThis.__pltExtensionMetricsRegistries
  strictEqual(registries.length, 2)

  await app.close()

  deepStrictEqual(globalThis.__pltExtensionEvents, [
    { event: 'setup', extension: 'metrics-1' },
    { event: 'setup', extension: 'metrics-2' },
    { event: 'close', extension: 'metrics-2' },
    { event: 'close', extension: 'metrics-1' }
  ])

  for (const { registry } of registries) {
    const remaining = await registry.getMetricsAsJSON()
    deepStrictEqual(remaining, [])
  }
})

test('extension metrics registries are cleared after partial startup failure', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-metrics.json')
  const app = await createRuntime(configFile)

  // Force a failure after extensions are loaded by stopping before start completes
  // via an invalid port bind on the entrypoint after init.
  await app.init()

  const registries = globalThis.__pltExtensionMetricsRegistries
  strictEqual(registries.length, 1)
  const before = await registries[0].registry.getMetricsAsJSON()
  strictEqual(before.length, 1)

  await app.close()

  const after = await registries[0].registry.getMetricsAsJSON()
  deepStrictEqual(after, [])
})

test('disabled metrics keep getMetrics unavailable and do not expose extension samples', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic-metrics-disabled.json')
  const app = await createRuntime(configFile)
  await app.start()

  t.after(() => app.close())

  // Extensions still receive a registry so they can register safely
  strictEqual(globalThis.__pltExtensionMetricsRegistries.length, 1)
  const registered = await globalThis.__pltExtensionMetricsRegistries[0].registry.getMetricsAsJSON()
  strictEqual(registered.length, 1)

  await rejects(
    () => app.getMetrics('json'),
    err => {
      ok(err.message.includes('Metrics are disabled'))
      return true
    }
  )
})

test('output is unchanged when no extension metrics exist', async t => {
  cleanExtensionGlobals()
  process.env.PORT = 0

  const configFile = join(fixturesDir, 'extensions', 'platformatic.runtime.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.metrics = { port: 0 }
      return config
    }
  })
  await app.start()

  t.after(() => app.close())

  const { metrics } = await app.getMetrics('json')
  ok(Array.isArray(metrics))
  ok(metrics.some(metric => metric.name === 'process_resident_memory_bytes'))
  ok(metrics.some(metric => metric.name === 'platformatic_application_restarts_total'))
  ok(!metrics.some(metric => metric.name.startsWith('extension_')))

  const { metrics: text } = await app.getMetrics('text')
  ok(text.includes('# HELP process_resident_memory_bytes'))
  ok(text.includes('# TYPE process_resident_memory_bytes'))
  ok(!text.includes('extension_'))
})
