import client from '@platformatic/prom-client'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { WorkerMetricsAggregator } from '../lib/worker-metrics-aggregator.js'

function createWorker (applicationId, workerId, { counter = true, histogram = true } = {}) {
  const registry = new client.Registry()
  registry.setDefaultLabels({ applicationId, workerId })

  const worker = { key: {}, applicationId, workerId, registry }

  if (counter) {
    worker.counter = new client.Counter({
      name: 'requests_total',
      help: 'Requests',
      labelNames: ['route'],
      registers: [registry]
    })
  }

  if (histogram) {
    worker.histogram = new client.Histogram({
      name: 'request_duration_seconds',
      help: 'Duration',
      labelNames: ['route'],
      buckets: [0.1, 1],
      registers: [registry]
    })
  }

  return worker
}

async function collect (workers, unavailable = []) {
  const result = []

  for (const worker of workers) {
    result.push({
      key: worker.key,
      applicationId: worker.applicationId,
      metrics: unavailable.includes(worker) ? null : await worker.registry.getMetricsAsJSON()
    })
  }

  return result
}

async function aggregate (aggregator, workers, { unavailable = [], applications = ['app'] } = {}) {
  return aggregator.aggregate(await collect(workers, unavailable), new Set(applications))
}

function getValues (metrics, name, applicationId = 'app') {
  const families = metrics.filter(
    metric => metric.name === name && metric.values.every(value => value.labels.applicationId === applicationId)
  )

  return families.flatMap(family =>
    family.values.map(({ metricName, labels, value }) => (metricName ? { metricName, labels, value } : { labels, value }))
  )
}

function getValue (metrics, name, labels, metricName) {
  const values = getValues(metrics, name, labels.applicationId ?? 'app').filter(
    value => value.metricName === metricName && JSON.stringify(value.labels) === JSON.stringify(labels)
  )

  strictEqual(values.length, 1, `Expected a single ${metricName ?? name} series with labels ${JSON.stringify(labels)}`)
  return values[0].value
}

test('merges counters and histograms of all workers without the worker label', async () => {
  const workers = [createWorker('app', 0), createWorker('app', 1), createWorker('app', 2)]

  workers[0].counter.inc({ route: '/a' }, 1)
  workers[1].counter.inc({ route: '/a' }, 2)
  workers[2].counter.inc({ route: '/a' }, 3)
  workers[2].counter.inc({ route: '/b' }, 4)

  workers[0].histogram.observe({ route: '/a' }, 0.05)
  workers[1].histogram.observe({ route: '/a' }, 0.5)
  workers[2].histogram.observe({ route: '/a' }, 5)

  const metrics = await aggregate(new WorkerMetricsAggregator(), workers)

  strictEqual(metrics.filter(metric => metric.name === 'requests_total').length, 1)
  deepStrictEqual(getValues(metrics, 'requests_total'), [
    { labels: { route: '/a', applicationId: 'app' }, value: 6 },
    { labels: { route: '/b', applicationId: 'app' }, value: 4 }
  ])

  deepStrictEqual(getValues(metrics, 'request_duration_seconds'), [
    { metricName: 'request_duration_seconds_bucket', labels: { le: 0.1, route: '/a', applicationId: 'app' }, value: 1 },
    { metricName: 'request_duration_seconds_bucket', labels: { le: 1, route: '/a', applicationId: 'app' }, value: 2 },
    {
      metricName: 'request_duration_seconds_bucket',
      labels: { le: '+Inf', route: '/a', applicationId: 'app' },
      value: 3
    },
    { metricName: 'request_duration_seconds_sum', labels: { route: '/a', applicationId: 'app' }, value: 5.55 },
    { metricName: 'request_duration_seconds_count', labels: { route: '/a', applicationId: 'app' }, value: 3 }
  ])

  for (const metric of metrics) {
    strictEqual(metric.help, metric.name === 'requests_total' ? 'Requests' : 'Duration')
    ok(['counter', 'histogram'].includes(metric.type))
  }
})

test('merges series regardless of the order of their labels', async () => {
  const workers = [createWorker('app', 0), createWorker('app', 1)]

  const gauges = workers.map(
    worker =>
      new client.Gauge({ name: 'connections', help: 'Connections', labelNames: ['a', 'b'], registers: [worker.registry] })
  )

  gauges[0].set({ a: '1', b: '2' }, 1)
  gauges[1].set({ b: '2', a: '1' }, 2)

  const metrics = await aggregate(new WorkerMetricsAggregator(), workers)
  const values = getValues(metrics, 'connections')

  strictEqual(values.length, 1)
  strictEqual(values[0].value, 3)
})

test('merges gauges using their aggregator', async () => {
  const workers = [createWorker('app', 0), createWorker('app', 1), createWorker('app', 2)]
  const aggregators = ['sum', 'average', 'min', 'max', 'first', 'omit']

  for (const worker of workers) {
    for (const aggregator of aggregators) {
      const gauge = new client.Gauge({ name: `gauge_${aggregator}`, help: aggregator, aggregator, registers: [worker.registry] })
      gauge.set((worker.workerId + 1) * 10)
    }

    // Gauges without an explicit aggregator are summed
    new client.Gauge({ name: 'gauge_default', help: 'default', registers: [worker.registry] }).set(1)
  }

  const metrics = await aggregate(new WorkerMetricsAggregator(), workers)

  strictEqual(getValue(metrics, 'gauge_sum', { applicationId: 'app' }), 60)
  strictEqual(getValue(metrics, 'gauge_average', { applicationId: 'app' }), 20)
  strictEqual(getValue(metrics, 'gauge_min', { applicationId: 'app' }), 10)
  strictEqual(getValue(metrics, 'gauge_max', { applicationId: 'app' }), 30)
  strictEqual(getValue(metrics, 'gauge_first', { applicationId: 'app' }), 10)
  strictEqual(getValue(metrics, 'gauge_default', { applicationId: 'app' }), 3)
  strictEqual(metrics.filter(metric => metric.name === 'gauge_omit').length, 0)
})

test('reports summaries per worker', async () => {
  const workers = [createWorker('app', 0), createWorker('app', 1)]

  for (const worker of workers) {
    const summary = new client.Summary({
      name: 'latency_seconds',
      help: 'Latency',
      percentiles: [0.5],
      registers: [worker.registry]
    })
    summary.observe(worker.workerId + 1)
  }

  const metrics = await aggregate(new WorkerMetricsAggregator(), workers)
  const summaries = metrics.filter(metric => metric.name === 'latency_seconds')

  strictEqual(summaries.length, 2)
  deepStrictEqual(
    summaries.map(summary => summary.values.find(value => value.labels.quantile === 0.5)),
    [
      { labels: { quantile: 0.5, applicationId: 'app', workerId: 0 }, value: 1 },
      { labels: { quantile: 0.5, applicationId: 'app', workerId: 1 }, value: 2 }
    ]
  )
})

test('keeps the merged counters monotonic when a worker is replaced', async () => {
  const aggregator = new WorkerMetricsAggregator()
  const first = createWorker('app', 0)
  const second = createWorker('app', 1)

  first.counter.inc({ route: '/a' }, 5)
  second.counter.inc({ route: '/a' }, 5)

  let metrics = await aggregate(aggregator, [first, second])
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 10)

  // The second worker is replaced by a new one, which starts from zero
  const replacement = createWorker('app', 1)
  replacement.counter.inc({ route: '/a' }, 1)

  metrics = await aggregate(aggregator, [first, replacement])
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 11)

  replacement.counter.inc({ route: '/a' }, 2)
  first.counter.inc({ route: '/a' }, 1)

  metrics = await aggregate(aggregator, [first, replacement])
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 14)

  // A worker removed when scaling down keeps contributing its last values
  metrics = await aggregate(aggregator, [first])
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 14)
})

test('keeps the last values of a worker which is temporarily unavailable', async () => {
  const aggregator = new WorkerMetricsAggregator()
  const workers = [createWorker('app', 0), createWorker('app', 1)]

  workers[0].counter.inc({ route: '/a' }, 1)
  workers[1].counter.inc({ route: '/a' }, 10)

  let metrics = await aggregate(aggregator, workers)
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 11)

  workers[0].counter.inc({ route: '/a' }, 1)
  workers[1].counter.inc({ route: '/a' }, 10)

  metrics = await aggregate(aggregator, workers, { unavailable: [workers[1]] })
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 12)

  metrics = await aggregate(aggregator, workers)
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 22)

  // A cumulative metric known only from an unavailable worker is still reported
  metrics = await aggregate(aggregator, [workers[1]], { unavailable: [workers[1]] })
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 22)
})

test('detects a reset of the metrics of a worker', async () => {
  const aggregator = new WorkerMetricsAggregator()
  const worker = createWorker('app', 0)

  worker.counter.inc({ route: '/a' }, 5)
  worker.counter.inc({ route: '/b' }, 5)

  let metrics = await aggregate(aggregator, [worker])
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 5)

  // The registry is recreated in the same worker, as done when the metrics config is updated
  worker.registry.clear()
  worker.registry.setDefaultLabels({ applicationId: 'app', workerId: 0 })

  metrics = await aggregate(aggregator, [worker])
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 5)
  strictEqual(getValue(metrics, 'requests_total', { route: '/b', applicationId: 'app' }), 5)

  const counter = new client.Counter({
    name: 'requests_total',
    help: 'Requests',
    labelNames: ['route'],
    registers: [worker.registry]
  })
  counter.inc({ route: '/a' }, 7)

  metrics = await aggregate(aggregator, [worker])
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 12)
  strictEqual(getValue(metrics, 'requests_total', { route: '/b', applicationId: 'app' }), 5)

  // A metric reset with a value lower than the previous one
  counter.reset()
  counter.inc({ route: '/a' }, 1)
  counter.inc({ route: '/b' }, 100)

  metrics = await aggregate(aggregator, [worker])
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'app' }), 13)
  strictEqual(getValue(metrics, 'requests_total', { route: '/b', applicationId: 'app' }), 105)
})

test('keeps the histogram buckets consistent when a worker is replaced', async () => {
  const aggregator = new WorkerMetricsAggregator()
  const first = createWorker('app', 0)
  const second = createWorker('app', 1)

  for (const value of [0.05, 0.5, 5]) {
    first.histogram.observe({ route: '/a' }, value)
    second.histogram.observe({ route: '/a' }, value)
  }

  await aggregate(aggregator, [first, second])

  // The replacement observes enough values to exceed the previous count of the worker
  const replacement = createWorker('app', 1)
  for (let i = 0; i < 5; i++) {
    replacement.histogram.observe({ route: '/a' }, 5)
  }

  const metrics = await aggregate(aggregator, [first, replacement])
  const labels = { route: '/a', applicationId: 'app' }
  const bucket = le => getValue(metrics, 'request_duration_seconds', { le, ...labels }, 'request_duration_seconds_bucket')

  strictEqual(bucket(0.1), 2)
  strictEqual(bucket(1), 4)
  strictEqual(bucket('+Inf'), 11)
  strictEqual(getValue(metrics, 'request_duration_seconds', labels, 'request_duration_seconds_count'), 11)
})

test('sums the metrics reset on collection without carrying their values', async () => {
  const aggregator = new WorkerMetricsAggregator({ nonCumulativeMetrics: ['interval_requests_total'] })
  const workers = [createWorker('app', 0), createWorker('app', 1)]

  const counters = workers.map(
    worker => new client.Counter({ name: 'interval_requests_total', help: 'Interval', registers: [worker.registry] })
  )

  counters[0].inc(3)
  counters[1].inc(4)

  let metrics = await aggregate(aggregator, workers)
  strictEqual(getValue(metrics, 'interval_requests_total', { applicationId: 'app' }), 7)

  // Values are reset after the collection, so they are never carried forward
  counters[0].reset()
  counters[0].inc(1)
  metrics = await aggregate(aggregator, [workers[0], createWorker('app', 1)])
  strictEqual(getValue(metrics, 'interval_requests_total', { applicationId: 'app' }), 1)
})

test('keeps the applications separate and forgets the removed ones', async () => {
  const aggregator = new WorkerMetricsAggregator()
  const first = createWorker('first', 0)
  const second = createWorker('second', 0)

  first.counter.inc({ route: '/a' }, 1)
  second.counter.inc({ route: '/a' }, 2)

  let metrics = await aggregate(aggregator, [first, second], { applications: ['first', 'second'] })
  strictEqual(metrics.filter(metric => metric.name === 'requests_total').length, 2)
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'first' }), 1)
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'second' }), 2)

  // The second application is removed along with its workers
  metrics = await aggregate(aggregator, [first], { applications: ['first'] })
  strictEqual(getValues(metrics, 'requests_total', 'second').length, 0)
  strictEqual(getValue(metrics, 'requests_total', { route: '/a', applicationId: 'first' }), 1)
})

test('supports a custom worker label', async () => {
  const registries = [0, 1].map(index => {
    const registry = new client.Registry()
    registry.setDefaultLabels({ applicationId: 'app', thread: index })
    new client.Counter({ name: 'custom_total', help: 'Custom', registers: [registry] }).inc(index + 1)
    return registry
  })

  const aggregator = new WorkerMetricsAggregator({ workerLabel: 'thread' })
  const metrics = aggregator.aggregate(
    [
      { key: {}, applicationId: 'app', metrics: await registries[0].getMetricsAsJSON() },
      { key: {}, applicationId: 'app', metrics: await registries[1].getMetricsAsJSON() }
    ],
    new Set(['app'])
  )

  deepStrictEqual(getValues(metrics, 'custom_total'), [{ labels: { applicationId: 'app' }, value: 3 }])
})
