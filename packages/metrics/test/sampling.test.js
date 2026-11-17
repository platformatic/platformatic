import assert from 'node:assert/strict'
import os from 'node:os'
import { performance } from 'node:perf_hooks'
import { test } from 'node:test'
import {
  clearRegistry,
  client,
  collectEluMetric,
  collectSystemCpuMetric,
  collectThreadCpuMetrics
} from '../index.js'

const collectors = [
  {
    name: 'ELU',
    metric: 'nodejs_eventloop_utilization',
    collect: collectEluMetric,
    scale: 1,
    mock (t, sample) {
      return t.mock.method(performance, 'eventLoopUtilization', (end, start) => {
        if (!end) {
          return { ...sample() }
        }
        const active = end.active - start.active
        const idle = end.idle - start.idle
        return { active, idle, utilization: active / (active + idle) }
      })
    }
  },
  {
    name: 'system CPU',
    metric: 'process_cpu_percent_usage',
    collect: collectSystemCpuMetric,
    scale: 100,
    mock (t, sample) {
      return t.mock.method(os, 'cpus', () => [{
        times: { user: sample().active, system: 0, idle: sample().idle }
      }])
    }
  },
  {
    name: 'thread CPU',
    metric: 'thread_cpu_percent_usage',
    collect: collectThreadCpuMetrics,
    scale: 100,
    mock (t, sample) {
      t.mock.method(process.hrtime, 'bigint', () => BigInt(sample().active + sample().idle) * 1000000n)
      return t.mock.method(process, 'threadCpuUsage', () => ({
        user: sample().active * 600,
        system: sample().active * 400
      }))
    }
  }
]

for (const collector of collectors) {
  test(`${collector.name} reads do not reset the sampling window`, async t => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    let sample = { active: 100, idle: 100 }
    collector.mock(t, () => sample)
    const registry = new client.Registry()
    t.after(() => clearRegistry(registry))
    await collector.collect(registry)

    sample = { active: 150, idle: 150 }
    const read = async () => {
      const metrics = await registry.getMetricsAsJSON()
      return metrics.find(metric => metric.name === collector.metric).values[0].value
    }
    assert.equal(await read(), 0.5 * collector.scale)
    await registry.metrics()
    assert.equal(await read(), 0.5 * collector.scale)

    sample = { active: 150, idle: 250 }
    assert.equal(await read(), 0.25 * collector.scale)
    assert.equal(await read(), 0.25 * collector.scale)
  })

  test(`${collector.name} rotates windows independently of reads and cleans up`, async t => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    let sample = { active: 100, idle: 100 }
    const sampleMock = collector.mock(t, () => sample)
    const registry = new client.Registry()
    t.after(() => clearRegistry(registry))
    await collector.collect(registry)

    // Re-registering must not create another timer or replace the baseline.
    sample = { active: 200, idle: 100 }
    await collector.collect(registry)
    t.mock.timers.tick(60000)

    sample = { active: 200, idle: 200 }
    let metrics = await registry.getMetricsAsJSON()
    assert.equal(metrics.find(metric => metric.name === collector.metric).values[0].value, 0.5 * collector.scale)

    sample = { active: 300, idle: 200 }
    t.mock.timers.tick(60000)
    metrics = await registry.getMetricsAsJSON()
    assert.equal(metrics.find(metric => metric.name === collector.metric).values[0].value, 0.5 * collector.scale)

    sample = { active: 300, idle: 400 }
    metrics = await registry.getMetricsAsJSON()
    assert.equal(metrics.find(metric => metric.name === collector.metric).values[0].value, 0.25 * collector.scale)

    clearRegistry(registry)
    const calls = sampleMock.mock.callCount()
    t.mock.timers.tick(120000)
    assert.equal(sampleMock.mock.callCount(), calls)

    await collector.collect(registry)
    sample = { active: 400, idle: 500 }
    metrics = await registry.getMetricsAsJSON()
    assert.equal(metrics.find(metric => metric.name === collector.metric).values[0].value, 0.5 * collector.scale)
  })
}

test('CPU percentages are finite before CPU time advances', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  const sample = () => ({ active: 100, idle: 100 })
  collectors[1].mock(t, sample)
  collectors[2].mock(t, sample)
  const registry = new client.Registry()
  t.after(() => clearRegistry(registry))
  collectSystemCpuMetric(registry)
  await collectThreadCpuMetrics(registry)

  for (const metric of await registry.getMetricsAsJSON()) {
    assert.equal(metric.values[0].value, 0)
  }
})

test('thread CPU counters remain cumulative across reads and window rotations', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let sample = { active: 100, idle: 100 }
  collectors[2].mock(t, () => sample)
  const registry = new client.Registry()
  t.after(() => clearRegistry(registry))
  await collectThreadCpuMetrics(registry)

  for (let i = 1; i <= 3; i++) {
    sample = { active: 100 + 100 * i, idle: 100 + 100 * i }
    t.mock.timers.tick(60000)
    await registry.metrics()
    const metrics = await registry.getMetricsAsJSON()
    const value = name => metrics.find(metric => metric.name === name).values[0].value
    assert.ok(Math.abs(value('thread_cpu_user_system_seconds_total') - 0.06 * i) < 1e-9)
    assert.ok(Math.abs(value('thread_cpu_system_seconds_total') - 0.04 * i) < 1e-9)
    assert.ok(Math.abs(value('thread_cpu_seconds_total') - 0.1 * i) < 1e-9)
  }
})
