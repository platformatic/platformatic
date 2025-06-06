'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { collectMetrics, client } = require('..')

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
