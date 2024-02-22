'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')
const errors = require('./errors')

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

  client.pipeRuntimeLogsStream(runtime.pid, options, (message) => {
    process.stdout.write(message)
  })

  process.on('SIGINT', async () => {
    await client.close()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await client.close()
    process.exit(0)
  })
}

module.exports = streamRuntimeLogsCommand
