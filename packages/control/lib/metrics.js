'use strict'

const RuntimeApiClient = require('./runtime-api-client')

async function streamRuntimeMetricsCommand () {
  const client = new RuntimeApiClient()
  const runtime = await client.getMatchingRuntime([])
  const metricsStream = client.getRuntimeLiveMetricsStream(runtime.pid)
  metricsStream.on('data', (data) => {
    const metrics = data.toString().split('\n').filter(Boolean)

    for (const metric of metrics) {
      try {
        process.stdout.write(metric)
      } catch (err) {
        console.error('Failed to parse metric: ', metric, err)
      }
    }
  })

  process.on('SIGINT', () => {
    metricsStream.destroy()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    metricsStream.destroy()
    process.exit(0)
  })
}

module.exports = streamRuntimeMetricsCommand
