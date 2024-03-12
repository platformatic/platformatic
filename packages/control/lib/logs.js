'use strict'

const { parseArgs } = require('node:util')
const { prettyFactory } = require('pino-pretty')
const RuntimeApiClient = require('./runtime-api-client')

const pinoLogLevels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10
}

async function streamRuntimeLogsCommand (argv) {
  const args = parseArgs({
    args: argv,
    options: {
      pid: { type: 'string', short: 'p' },
      name: { type: 'string', short: 'n' },
      level: { type: 'string', short: 'l', default: 'info' },
      pretty: { type: 'string', default: 'true' },
      service: { type: 'string', short: 's' }
    },
    strict: false
  }).values

  const client = new RuntimeApiClient()
  const runtime = await client.getMatchingRuntime(args)

  const logLevelNumber = pinoLogLevels[args.level]
  const prettify = prettyFactory()

  const logsStream = client.getRuntimeLiveLogsStream(runtime.pid)

  logsStream.on('data', (data) => {
    const logs = data.toString().split('\n').filter(Boolean)

    for (let log of logs) {
      try {
        const parsedLog = JSON.parse(log)
        if (parsedLog.level < logLevelNumber) continue
        if (args.service && parsedLog.name !== args.service) continue
        if (args.pretty !== 'false') {
          log = prettify(parsedLog)
        } else {
          log += '\n'
        }
        process.stdout.write(log)
      } catch (err) {
        console.error('Failed to parse log message: ', log, err)
      }
    }
  })

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
