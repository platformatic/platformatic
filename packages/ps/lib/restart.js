'use strict'

const { parseArgs } = require('node:util')
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
    throw new Error('You must specify either a PID or a package name')
  }

  if (!runtime) {
    throw new Error('Runtime not found')
  }

  await restartRuntimeServices(runtime.pid)
  console.log(`Restarted runtime "${runtime.packageName}".`)
}

module.exports = restartRuntimeServicesCommand
