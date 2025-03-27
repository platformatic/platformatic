'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { collectMetrics, client } = require('..')

test('returns expected structure', async (t) => {
  const result = await collectMetrics('test-service', 1, {})

  assert.ok(result.registry)
  assert.equal(typeof result.startHttpTimer, 'function')
  assert.equal(typeof result.endHttpTimer, 'function')
})

test('accepts custom registry', async (t) => {
  const customRegistry = new client.Registry()
  const result = await collectMetrics('test-service', 1, {}, customRegistry)

  assert.strictEqual(result.registry, customRegistry)
})

test('with defaultMetrics enabled', async (t) => {
  const result = await collectMetrics('test-service', 1, {
    defaultMetrics: true
  })

  const metrics = await result.registry.getMetricsAsJSON()
  assert.ok(metrics.length > 0)
})

test('thread cpu metrics are created when defaultMetrics is enabled', async (t) => {
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
