'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')
const errors = require('./errors')

async function startRuntimeServicesCommand (argv) {
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

  await client.startRuntimeServices(runtime.pid)
  console.log(`Started runtime "${runtime.packageName}".`)

  await client.close()
}

module.exports = startRuntimeServicesCommand
