'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { collectMetrics, client } = require('..')

const nextTick = () => new Promise(resolve => process.nextTick(resolve))

test('returns expected structure', async () => {
  const result = await collectMetrics('test-service', 1, {})

  assert.ok(result.registry)
})

test('accepts custom registry', async () => {
  const customRegistry = new client.Registry()
  const result = await collectMetrics('test-service', 1, {}, customRegistry)

  assert.strictEqual(result.registry, customRegistry)
})

test('with defaultMetrics enabled', async () => {
  const result = await collectMetrics('test-service', 1, {
    defaultMetrics: true
  })

  const metrics = await result.registry.getMetricsAsJSON()
  assert.ok(metrics.length > 0)
})

test('thread cpu metrics are created when defaultMetrics is enabled', async () => {
  const result = await collectMetrics('test-service', 1, {
    defaultMetrics: true
  })

  const metrics = await result.registry.getMetricsAsJSON()
  const metricNames = metrics.map(m => m.name)

  assert.ok(metricNames.includes('thread_cpu_user_system_seconds_total'))
  assert.ok(metricNames.includes('thread_cpu_system_seconds_total'))
  assert.ok(metricNames.includes('thread_cpu_seconds_total'))
  assert.ok(metricNames.includes('thread_cpu_percent_usage'))
})

test('workerId is properly included in labels when zero', async () => {
  const result = await collectMetrics('test-service', 0, { defaultMetrics: true })
  const [{ values }] = await result.registry.getMetricsAsJSON()
  assert.strictEqual(values[0].labels.workerId, 0)
})

test('workerId is properly included in labels when positive', async () => {
  const result = await collectMetrics('test-service', 42, { defaultMetrics: true })
  const [{ values }] = await result.registry.getMetricsAsJSON()
  assert.strictEqual(values[0].labels.workerId, 42)
})

test('workerId is NOT included in labels when negative', async () => {
  const result = await collectMetrics('test-service', -42, { defaultMetrics: true })
  const [{ values }] = await result.registry.getMetricsAsJSON()
  assert.strictEqual(values[0].labels.workerId, undefined)
})

test('httpMetrics creates histogram and summary with collect functions', async () => {
  const result = await collectMetrics('test-service', 1, { httpMetrics: true })
  const metrics = await result.registry.getMetricsAsJSON()

  const histogram = metrics.find(m => m.name === 'http_request_all_duration_seconds')
  const summary = metrics.find(m => m.name === 'http_request_all_summary_seconds')

  assert.ok(histogram, 'histogram metric should exist')
  assert.ok(summary, 'summary metric should exist')
  assert.strictEqual(histogram.help, 'request duration in seconds summary for all requests')
  assert.strictEqual(summary.help, 'request duration in seconds histogram for all requests')
})

test('httpMetrics histogram resets after metric collection', async () => {
  const result = await collectMetrics('test-service', 1, { httpMetrics: true })

  const metricObjects = result.registry._metrics
  const histogramMetric = metricObjects.http_request_all_duration_seconds

  histogramMetric.observe({ method: 'GET', telemetry_id: 'test' }, 0.1)
  histogramMetric.observe({ method: 'GET', telemetry_id: 'test' }, 0.2)
  histogramMetric.observe({ method: 'GET', telemetry_id: 'test' }, 0.3)

  const metricsBefore = await result.registry.getMetricsAsJSON()
  const histogramBefore = metricsBefore.find(m => m.name === 'http_request_all_duration_seconds')
  assert.ok(histogramBefore.values.length > 0, 'histogram should have values before collection')

  await result.registry.metrics()

  await nextTick()

  const metricsAfter = await result.registry.getMetricsAsJSON()
  const histogramAfter = metricsAfter.find(m => m.name === 'http_request_all_duration_seconds')

  const sum = histogramAfter.values.find(v => v.metricName === 'http_request_all_duration_seconds_sum')
  const count = histogramAfter.values.find(v => v.metricName === 'http_request_all_duration_seconds_count')
  assert.strictEqual(sum?.value || 0, 0, 'histogram sum should be reset to 0')
  assert.strictEqual(count?.value || 0, 0, 'histogram count should be reset to 0')
})

test('httpMetrics summary resets after metric collection', async () => {
  const result = await collectMetrics('test-service', 1, { httpMetrics: true })

  const metricObjects = result.registry._metrics
  const summaryMetric = metricObjects.http_request_all_summary_seconds

  summaryMetric.observe({ method: 'POST', telemetry_id: 'test' }, 0.15)
  summaryMetric.observe({ method: 'POST', telemetry_id: 'test' }, 0.25)
  summaryMetric.observe({ method: 'POST', telemetry_id: 'test' }, 0.35)

  const metricsBefore = await result.registry.getMetricsAsJSON()
  const summaryBefore = metricsBefore.find(m => m.name === 'http_request_all_summary_seconds')
  assert.ok(summaryBefore.values.length > 0, 'summary should have values before collection')

  await result.registry.metrics()

  await nextTick()

  const metricsAfter = await result.registry.getMetricsAsJSON()
  const summaryAfter = metricsAfter.find(m => m.name === 'http_request_all_summary_seconds')

  const sum = summaryAfter.values.find(v => v.metricName === 'http_request_all_summary_seconds_sum')
  const count = summaryAfter.values.find(v => v.metricName === 'http_request_all_summary_seconds_count')
  assert.strictEqual(sum?.value || 0, 0, 'summary sum should be reset to 0')
  assert.strictEqual(count?.value || 0, 0, 'summary count should be reset to 0')
})
