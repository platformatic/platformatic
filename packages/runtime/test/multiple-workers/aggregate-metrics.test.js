import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'
import { fixturesDir } from './helper.js'

const fixtureRoot = join(fixturesDir, 'aggregate-worker-metrics')
const configFile = join(fixtureRoot, 'platformatic.json')

async function createRuntimeWithMetricsConfig (metricsConfig) {
  const config = JSON.parse(await readFile(configFile, 'utf-8'))
  config.metrics = { ...config.metrics, ...metricsConfig }
  return createRuntime(fixtureRoot, config)
}

async function sendRequests (app, count) {
  const workers = new Set()

  for (let i = 0; i < count; i++) {
    const res = await app.inject('node', { method: 'GET', url: '/hello' })
    strictEqual(res.statusCode, 200)
    workers.add(JSON.parse(res.body).worker)
  }

  return workers
}

function getFamilies (metrics, name) {
  return metrics.filter(metric => metric.name === name && metric.values[0]?.labels.applicationId === 'node')
}

function getHttpRequestsCount (metrics) {
  let count = 0

  for (const family of getFamilies(metrics, 'http_request_all_duration_seconds')) {
    for (const value of family.values) {
      if (value.metricName === 'http_request_all_duration_seconds_count') {
        count += value.value
      }
    }
  }

  return count
}

function getCounter (metrics) {
  const families = getFamilies(metrics, 'custom_requests_total')
  strictEqual(families.length, 1)
  return families[0].values
}

test('merges the metrics of all workers when aggregateWorkers is enabled', async t => {
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const workers = await sendRequests(app, 9)
  strictEqual(workers.size, 3)

  const { metrics } = await app.getMetrics()

  deepStrictEqual(getCounter(metrics), [{ value: 9, labels: { route: '/hello', applicationId: 'node' } }])

  const histograms = getFamilies(metrics, 'custom_request_duration_seconds')
  strictEqual(histograms.length, 1)
  deepStrictEqual(
    histograms[0].values.map(({ metricName, labels, value }) => ({ metricName, le: labels.le, value })),
    [
      { metricName: 'custom_request_duration_seconds_bucket', le: 0.1, value: 0 },
      { metricName: 'custom_request_duration_seconds_bucket', le: 1, value: 9 },
      { metricName: 'custom_request_duration_seconds_bucket', le: '+Inf', value: 9 },
      { metricName: 'custom_request_duration_seconds_sum', le: undefined, value: 4.5 },
      { metricName: 'custom_request_duration_seconds_count', le: undefined, value: 9 }
    ]
  )

  // The event loop utilization is averaged, so it is still a fraction
  const [elu] = getFamilies(metrics, 'nodejs_eventloop_utilization')
  strictEqual(elu.values.length, 1)
  ok(elu.values[0].value >= 0 && elu.values[0].value <= 1)

  // Summaries cannot be merged, so they are still reported per worker
  const summaries = getFamilies(metrics, 'custom_latency_seconds')
  deepStrictEqual(summaries.map(summary => summary.values[0].labels.workerId).sort(), [0, 1, 2])

  for (const metric of metrics) {
    if (metric.type === 'summary') {
      continue
    }

    for (const value of metric.values) {
      ok(!('workerId' in value.labels), `${metric.name} should not have the workerId label`)
    }
  }

  // The text format contains a single series per label set
  const { metrics: text } = await app.getMetrics('text')
  const lines = text.split('\n').filter(line => line.startsWith('custom_requests_total'))
  deepStrictEqual(lines, ['custom_requests_total{route="/hello",applicationId="node"} 9'])
})

test('keeps the merged counters monotonic when the workers are replaced', async t => {
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.start()
  await sendRequests(app, 9)

  let { metrics } = await app.getMetrics()
  deepStrictEqual(getCounter(metrics), [{ value: 9, labels: { route: '/hello', applicationId: 'node' } }])

  // All the workers are replaced by new ones, whose counters start from zero
  await app.restartApplication('node')

  metrics = (await app.getMetrics()).metrics
  deepStrictEqual(getCounter(metrics), [{ value: 9, labels: { route: '/hello', applicationId: 'node' } }])

  await sendRequests(app, 3)

  metrics = (await app.getMetrics()).metrics
  deepStrictEqual(getCounter(metrics), [{ value: 12, labels: { route: '/hello', applicationId: 'node' } }])

  // The histogram of the new workers is merged with the one of the old workers
  const [histogram] = getFamilies(metrics, 'custom_request_duration_seconds')
  const count = histogram.values.find(value => value.metricName === 'custom_request_duration_seconds_count')
  strictEqual(count.value, 12)
})

test('concurrent collections share the same result', async t => {
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.start()
  await sendRequests(app, 6)

  const results = await Promise.all([app.getMetrics(), app.getMetrics(), app.getMetrics('text')])

  // The merged metrics are computed once and shared by all the callers
  strictEqual(getFamilies(results[0].metrics, 'custom_requests_total')[0], getFamilies(results[1].metrics, 'custom_requests_total')[0])
  deepStrictEqual(getCounter(results[0].metrics), [{ value: 6, labels: { route: '/hello', applicationId: 'node' } }])
  ok(results[2].metrics.includes('custom_requests_total{route="/hello",applicationId="node"} 6'))

  // A later collection still reports the same total
  const { metrics } = await app.getMetrics()
  deepStrictEqual(getCounter(metrics), [{ value: 6, labels: { route: '/hello', applicationId: 'node' } }])
})

test('resets the HTTP metrics after each collection by default', async t => {
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await app.start()
  await sendRequests(app, 9)

  let { metrics } = await app.getMetrics()
  strictEqual(getHttpRequestsCount(metrics), 9)

  metrics = (await app.getMetrics()).metrics
  strictEqual(getHttpRequestsCount(metrics), 0)

  // The values of the replaced workers are not carried forward
  await sendRequests(app, 3)
  await app.restartApplication('node')
  await sendRequests(app, 3)

  metrics = (await app.getMetrics()).metrics
  strictEqual(getHttpRequestsCount(metrics), 3)
})

test('keeps the HTTP metrics cumulative when resetHttpMetrics is false', async t => {
  const app = await createRuntimeWithMetricsConfig({ resetHttpMetrics: false })

  t.after(async () => {
    await app.close()
  })

  await app.start()
  await sendRequests(app, 9)

  let { metrics } = await app.getMetrics()
  strictEqual(getHttpRequestsCount(metrics), 9)

  metrics = (await app.getMetrics()).metrics
  strictEqual(getHttpRequestsCount(metrics), 9)

  // The values of the replaced workers are carried forward
  await app.restartApplication('node')
  await sendRequests(app, 3)

  metrics = (await app.getMetrics()).metrics
  strictEqual(getHttpRequestsCount(metrics), 12)
})
