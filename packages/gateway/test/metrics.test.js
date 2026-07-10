import { ok, strictEqual } from 'node:assert'
import { test } from 'node:test'
import promClient from '@platformatic/prom-client'
import { initMetrics } from '../lib/metrics.js'

test('initMetrics should return null when prometheus is not provided', async () => {
  const result = initMetrics()
  strictEqual(result, null)
})

test('initMetrics should return null when prometheus is null', async () => {
  const result = initMetrics(null)
  strictEqual(result, null)
})

test('initMetrics should return null when prometheus.registry is missing', async () => {
  const prometheus = { client: promClient }
  const result = initMetrics(prometheus)
  strictEqual(result, null)
})

test('initMetrics should return null when prometheus.client is missing', async () => {
  const prometheus = { registry: new promClient.Registry() }
  const result = initMetrics(prometheus)
  strictEqual(result, null)
})

test('initMetrics should return metrics object when prometheus is properly configured', async () => {
  const registry = new promClient.Registry()
  const prometheus = { registry, client: promClient }
  const metrics = initMetrics(prometheus)

  ok(metrics, 'Metrics object should be created')
  ok(metrics.activeWsConnections, 'activeWsConnections metric should exist')
  ok(metrics.deduplicationLeader, 'deduplicationLeader metric should exist')
  ok(metrics.deduplicationWaiter, 'deduplicationWaiter metric should exist')
  ok(metrics.deduplicationReplay, 'deduplicationReplay metric should exist')
  ok(metrics.deduplicationFallback, 'deduplicationFallback metric should exist')
  ok(metrics.deduplicationError, 'deduplicationError metric should exist')
  ok(metrics.deduplicationSkip, 'deduplicationSkip metric should exist')
})

test('activeWsConnections should be configured as Gauge with correct properties', async () => {
  const registry = new promClient.Registry()
  const prometheus = { registry, client: promClient }
  const metrics = initMetrics(prometheus)

  const gauge = metrics.activeWsConnections
  strictEqual(gauge.name, 'active_ws_gateway_connections')
  ok(gauge.help.includes('Active Websocket gateway connections'))
})

test('deduplication metrics should be configured as counters with correct names', async () => {
  const registry = new promClient.Registry()
  const prometheus = { registry, client: promClient }
  const metrics = initMetrics(prometheus)

  strictEqual(metrics.deduplicationLeader.name, 'gateway_deduplication_leader_count')
  strictEqual(metrics.deduplicationWaiter.name, 'gateway_deduplication_waiter_count')
  strictEqual(metrics.deduplicationReplay.name, 'gateway_deduplication_replay_count')
  strictEqual(metrics.deduplicationFallback.name, 'gateway_deduplication_fallback_count')
  strictEqual(metrics.deduplicationError.name, 'gateway_deduplication_error_count')
  strictEqual(metrics.deduplicationSkip.name, 'gateway_deduplication_skip_count')
})
