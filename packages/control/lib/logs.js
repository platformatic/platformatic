'use strict'

const { parseArgs } = require('node:util')
const errors = require('./errors')
const {
  getRuntimeByPID,
  getRuntimeByPackageName,
  pipeRuntimeLogsStream
} = require('./runtime-api')

async function streamRuntimeLogsCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' },
      level: { type: 'string', short: 'l', default: 'info' },
      pretty: { type: 'boolean', default: true },
      service: { type: 'string', short: 's' }
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

  const options = {}
  if (args.level !== undefined) {
    options.level = args.level
  }
  if (args.pretty !== undefined) {
    options.pretty = args.pretty
  }
  if (args.service !== undefined) {
    options.serviceId = args.service
  }

  pipeRuntimeLogsStream(runtime.pid, options, (message) => {
    process.stdout.write(message)
  })
}

module.exports = streamRuntimeLogsCommand
