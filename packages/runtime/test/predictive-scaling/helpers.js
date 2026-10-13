import assert from 'node:assert/strict'
import { finalizeConfiguration } from '../../lib/config.js'

export async function createWorkersConfig (workers = {}) {
  const config = { workers, watch: false }
  await finalizeConfiguration(config, [], {}, false)
  return config.workers
}

export function processAndAssertMetric (applicationScaler, metricName, timestamp, expectedLevel, expectedTimestamp = timestamp) {
  applicationScaler.process(timestamp)
  const { level, lastProcessedTs } = applicationScaler.getDiagnostics().metrics[metricName]
  assert.equal(lastProcessedTs, expectedTimestamp)
  assert.equal(level, expectedLevel, `${metricName} level at ${timestamp}`)
}

export function getMetricEntries (store, startTs, endTs) {
  const entries = []
  store.forEachEntry(startTs, endTs, (timestamp, value) => entries.push({ timestamp, value }))
  return entries
}
