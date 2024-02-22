'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')
const errors = require('./errors')

async function closeRuntimeServicesCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' }
    },
    strict: false
  }).values

  const client = new RuntimeApiClient()

  let runtime = null
  if (args.pid) {
    runtime = await client.getRuntimeByPID(parseInt(args.pid))
  } else if (args.name) {
    runtime = await client.getRuntimeByPackageName(args.name)
  } else {
    throw errors.MissingRuntimeIdentifier()
  }

  if (!runtime) {
    throw errors.RuntimeNotFound()
  }

  await client.closeRuntimeServices(runtime.pid)
  console.log(`Closed runtime "${runtime.packageName}".`)

  await client.close()
}

module.exports = closeRuntimeServicesCommand
