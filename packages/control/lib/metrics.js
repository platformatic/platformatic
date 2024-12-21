'use strict'

const RuntimeApiClient = require('./runtime-api-client')

async function runtimeMetricsCommand () {
  const client = new RuntimeApiClient()
  const runtime = await client.getMatchingRuntime([])
  const metrics = await client.getRuntimeMetrics(runtime.pid, { format: 'json' })
  console.log(JSON.stringify(metrics, null, 2))
  await client.close()
}

module.exports = runtimeMetricsCommand
