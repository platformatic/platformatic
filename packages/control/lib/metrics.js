'use strict'

const { parseArgs } = require('node:util')

const RuntimeApiClient = require('./runtime-api-client')

async function runtimeMetricsCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      format: { type: 'string', short: 'f', default: 'json' }
    },
    strict: false,
  }).values

  const client = new RuntimeApiClient()
  const runtimePid = args.pid || (await client.getMatchingRuntime([])).pid
  const metrics = await client.getRuntimeMetrics(parseInt(runtimePid), { format: args.format })
  const result = args.format === 'text' ? metrics : JSON.stringify(metrics, null, 2)
  console.log(result)
  await client.close()
}

module.exports = runtimeMetricsCommand
