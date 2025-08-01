import { test } from 'node:test'
import { strictEqual, ok } from 'node:assert'
import { initMetrics } from '../lib/metrics.js'
import promClient from 'prom-client'

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
})

test('activeWsConnections should be configured as Gauge with correct properties', async () => {
  const registry = new promClient.Registry()
  const prometheus = { registry, client: promClient }
  const metrics = initMetrics(prometheus)

  const gauge = metrics.activeWsConnections
  strictEqual(gauge.name, 'active_ws_composer_connections')
  ok(gauge.help.includes('Active Websocket composer connections'))
})
