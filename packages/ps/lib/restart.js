'use strict'

const { parseArgs } = require('node:util')
const errors = require('./errors')
const {
  getRuntimeByPID,
  getRuntimeByPackageName,
  restartRuntimeServices
} = require('./runtime-api')

async function restartRuntimeServicesCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' }
    },
    strict: false
  }).values

  let runtime = null
  if (args.pid) {
    runtime = await getRuntimeByPID(parseInt(args.pid))
  } else if (args.name) {
    runtime = await getRuntimeByPackageName(args.name)
  } else {
    throw errors.MissingRuntimeIdentifier()
  }

  if (!runtime) {
    throw errors.RuntimeNotFound()
  }

  await restartRuntimeServices(runtime.pid)
  console.log(`Restarted runtime "${runtime.packageName}".`)
}

module.exports = restartRuntimeServicesCommand
