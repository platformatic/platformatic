'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')

async function stopRuntimeServicesCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' }
    },
    strict: false
  }).values

  const client = new RuntimeApiClient()
  const runtime = await client.getMatchingRuntime(args)

  await client.stopRuntimeServices(runtime.pid)
  console.log(`Stopped runtime "${runtime.packageName}".`)

  await client.close()
}

module.exports = stopRuntimeServicesCommand
