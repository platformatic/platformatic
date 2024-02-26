'use strict'

const { parseArgs } = require('node:util')
const RuntimeApiClient = require('./runtime-api-client')

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
  const runtime = await client.getMatchingRuntime(args)

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

  const logsStream = client.getRuntimeLogsStream(runtime.pid, options)
  logsStream.pipe(process.stdout)

  process.on('SIGINT', () => {
    logsStream.destroy()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    logsStream.destroy()
    process.exit(0)
  })
}

module.exports = streamRuntimeLogsCommand
