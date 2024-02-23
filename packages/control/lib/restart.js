'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')
const errors = require('./errors')

async function restartRuntimeServicesCommand (argv) {
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

  if (!runtime) {
    throw errors.RuntimeNotFound()
  }

  await client.restartRuntimeServices(runtime.pid)
  console.log(`Restarted runtime "${runtime.packageName}".`)

  await client.close()
}

module.exports = restartRuntimeServicesCommand
