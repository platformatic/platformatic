import assert from 'node:assert'
import { test } from 'node:test'
import { buildCustomLabelsConfig, client, collectMetrics } from '../index.js'

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

  // Get the histogram metric using the public API
  const histogramMetric = result.registry.getSingleMetric('http_request_all_duration_seconds')
  assert.ok(histogramMetric, 'histogram metric should exist')

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

  // Get the summary metric using the public API
  const summaryMetric = result.registry.getSingleMetric('http_request_all_summary_seconds')
  assert.ok(summaryMetric, 'summary metric should exist')

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

// Tests for buildCustomLabelsConfig
test('buildCustomLabelsConfig returns default telemetry_id when no config provided', () => {
  const result = buildCustomLabelsConfig(undefined)

  assert.deepStrictEqual(result.customLabels, ['telemetry_id'])
  assert.strictEqual(typeof result.getCustomLabels, 'function')

  // Test default getCustomLabels function
  const labels = result.getCustomLabels({ headers: { 'x-plt-telemetry-id': 'test-id' } })
  assert.deepStrictEqual(labels, { telemetry_id: 'test-id' })
})

test('buildCustomLabelsConfig returns default telemetry_id when empty array provided', () => {
  const result = buildCustomLabelsConfig([])

  assert.deepStrictEqual(result.customLabels, ['telemetry_id'])
})

test('buildCustomLabelsConfig returns empty object when header is missing', () => {
  const result = buildCustomLabelsConfig(undefined)

  const labels = result.getCustomLabels({ headers: {} })
  assert.deepStrictEqual(labels, {})
})

test('buildCustomLabelsConfig builds custom labels from configuration', () => {
  const config = [
    { name: 'domain', header: 'x-forwarded-host' },
    { name: 'api_version', header: 'x-api-version' }
  ]

  const result = buildCustomLabelsConfig(config)

  assert.deepStrictEqual(result.customLabels, ['domain', 'api_version'])
  assert.strictEqual(typeof result.getCustomLabels, 'function')
})

test('buildCustomLabelsConfig getCustomLabels extracts values from headers', () => {
  const config = [
    { name: 'domain', header: 'x-forwarded-host' },
    { name: 'api_version', header: 'x-api-version' }
  ]

  const result = buildCustomLabelsConfig(config)

  const labels = result.getCustomLabels({
    headers: {
      'x-forwarded-host': 'example.com',
      'x-api-version': 'v2'
    }
  })

  assert.deepStrictEqual(labels, { domain: 'example.com', api_version: 'v2' })
})

test('buildCustomLabelsConfig uses custom default value when header is missing', () => {
  const config = [
    { name: 'domain', header: 'x-forwarded-host', default: 'default-domain' },
    { name: 'api_version', header: 'x-api-version' }
  ]

  const result = buildCustomLabelsConfig(config)

  const labels = result.getCustomLabels({ headers: {} })

  assert.deepStrictEqual(labels, { domain: 'default-domain', api_version: 'unknown' })
})

test('buildCustomLabelsConfig handles case-insensitive header names', () => {
  const config = [
    { name: 'domain', header: 'X-Forwarded-Host' }
  ]

  const result = buildCustomLabelsConfig(config)

  // HTTP headers are case-insensitive, and Node.js lowercases them
  const labels = result.getCustomLabels({
    headers: {
      'x-forwarded-host': 'example.com'
    }
  })

  assert.deepStrictEqual(labels, { domain: 'example.com' })
})

test('httpMetrics with custom labels configuration', async () => {
  const httpCustomLabels = [
    { name: 'domain', header: 'x-forwarded-host', default: 'localhost' }
  ]

  const result = await collectMetrics('test-service', 1, {
    httpMetrics: true,
    httpCustomLabels
  })

  const metrics = await result.registry.getMetricsAsJSON()
  const histogram = metrics.find(m => m.name === 'http_request_all_duration_seconds')

  assert.ok(histogram, 'histogram metric should exist')

  // Verify custom label is used by observing a value
  const histogramMetric = result.registry.getSingleMetric('http_request_all_duration_seconds')
  histogramMetric.observe({ method: 'GET', domain: 'example.com' }, 0.1)

  const metricsAfterObserve = await result.registry.getMetricsAsJSON()
  const histogramAfterObserve = metricsAfterObserve.find(m => m.name === 'http_request_all_duration_seconds')

  // Check that the domain label is present in the recorded values
  const hasCustomLabel = histogramAfterObserve.values.some(v => v.labels?.domain === 'example.com')
  assert.ok(hasCustomLabel, 'custom domain label should be present in histogram values')
})

test('httpMetrics does not include telemetry_id label when header is not present', async () => {
  const result = await collectMetrics('test-service', 1, { httpMetrics: true })

  const histogramMetric = result.registry.getSingleMetric('http_request_all_duration_seconds')
  assert.ok(histogramMetric, 'histogram metric should exist')

  // Observe without telemetry_id (simulating request without x-plt-telemetry-id header)
  histogramMetric.observe({ method: 'GET' }, 0.1)

  const metrics = await result.registry.getMetricsAsJSON()
  const histogram = metrics.find(m => m.name === 'http_request_all_duration_seconds')

  // Find a value that has our method label
  const value = histogram.values.find(v => v.labels.method === 'GET')
  assert.ok(value, 'should have a value with method=GET')
  assert.strictEqual(value.labels.telemetry_id, undefined, 'telemetry_id should not be present when header is missing')
})
