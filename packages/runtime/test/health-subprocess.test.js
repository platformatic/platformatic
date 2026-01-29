import { ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')
const isWindows = process.platform === 'win32'

// Tests for subprocess mode (when capability uses startWithCommand)
// The custom-metrics fixture has an 'external' service that uses commands config,
// which spawns a subprocess via startWithCommand()

test('should collect health metrics for subprocess application with commands', { skip: isWindows && 'Skipping on Windows' }, async t => {
  const configFile = join(fixturesDir, 'custom-metrics', 'platformatic.json')

  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  // Collect health metrics events
  const healthMetrics = []
  app.on('application:worker:health:metrics', (metrics) => {
    healthMetrics.push(metrics)
  })

  await app.start()

  // Wait for health metrics to be collected (should happen within 2 seconds)
  await sleep(2500)

  // Filter for subprocess service 'external' (which uses commands config)
  const subprocessMetrics = healthMetrics.filter(m => m.application === 'external')

  ok(subprocessMetrics.length > 0, 'Should have collected health metrics for subprocess application')

  // Verify health metrics structure
  const metric = subprocessMetrics[0]
  ok(metric.currentHealth, 'Should have currentHealth')
  ok(typeof metric.currentHealth.elu === 'number', 'Should have ELU metric')
  ok(typeof metric.currentHealth.heapUsed === 'number', 'Should have heapUsed metric')
  ok(typeof metric.currentHealth.heapTotal === 'number', 'Should have heapTotal metric')
  strictEqual(metric.application, 'external')
  strictEqual(metric.worker, 0)
})

test('subprocess health metrics should have valid ELU values', { skip: isWindows && 'Skipping on Windows' }, async t => {
  const configFile = join(fixturesDir, 'custom-metrics', 'platformatic.json')

  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  // Collect multiple health metrics
  const healthMetrics = []
  app.on('application:worker:health:metrics', (metrics) => {
    if (metrics.application === 'external') {
      healthMetrics.push(metrics)
    }
  })

  await app.start()

  // Wait for multiple health checks
  await sleep(3000)

  ok(healthMetrics.length >= 2, 'Should have at least 2 health metrics')

  // ELU should be between 0 and 1
  for (const metric of healthMetrics) {
    const elu = metric.currentHealth.elu
    ok(elu >= 0 && elu <= 1, `ELU should be between 0 and 1, got ${elu}`)
  }
})

test('subprocess health metrics heap values should be reasonable', { skip: isWindows && 'Skipping on Windows' }, async t => {
  const configFile = join(fixturesDir, 'custom-metrics', 'platformatic.json')

  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  // Collect health metrics
  const healthMetrics = []
  app.on('application:worker:health:metrics', (metrics) => {
    if (metrics.application === 'external') {
      healthMetrics.push(metrics)
    }
  })

  await app.start()

  // Wait for health check
  await sleep(2000)

  ok(healthMetrics.length > 0, 'Should have collected health metrics')

  const metric = healthMetrics[0]
  const { heapUsed, heapTotal } = metric.currentHealth

  // Heap values should be positive numbers (in bytes)
  ok(heapUsed > 0, 'heapUsed should be positive')
  ok(heapTotal > 0, 'heapTotal should be positive')
  ok(heapUsed <= heapTotal, 'heapUsed should be <= heapTotal')

  // Reasonable bounds (at least 1MB heap, less than 1GB)
  ok(heapTotal >= 1024 * 1024, 'heapTotal should be at least 1MB')
  ok(heapTotal <= 1024 * 1024 * 1024, 'heapTotal should be less than 1GB')
})
