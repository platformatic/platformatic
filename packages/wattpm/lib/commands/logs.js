import { RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError } from '@platformatic/utils'
import pinoPretty from 'pino-pretty'
import split2 from 'split2'
import { getMatchingRuntimeArgs, parseArgs } from '../utils.js'

export async function logsCommand (logger, args) {
  const { values, positionals } = parseArgs(
    args,
    {
      level: { type: 'string', short: 'l', default: 'info' },
      pretty: { type: 'boolean', short: 'p', default: false }
    },
    false
  )

  const service = positionals[1]
  const minimumLevel = logger.levels.values[values.level]
  const output = values.pretty ? pinoPretty({ colorize: true }) : process.stdout

  try {
    const client = new RuntimeApiClient()
    const runtime = await client.getMatchingRuntime(getMatchingRuntimeArgs(positionals))

    const logsStream = client.getRuntimeLiveLogsStream(runtime.pid)

    function onClose () {
      logsStream.destroy()
      client.close()
    }

    process.on('SIGINT', onClose)
    process.on('SIGTERM', onClose)

    for await (const line of logsStream.pipe(split2())) {
      const parsed = JSON.parse(line)

      if (parsed.level < minimumLevel || (service && parsed.name !== service)) {
        continue
      }

      output.write(line + '\n')
    }
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      logger.fatal('Cannot find a matching runtime.')
    } else if (error.code === 'PLT_CTR_SERVICE_NOT_FOUND') {
      logger.fatal('Cannot find a matching service.')
    }

    logger.fatal(
      { error: ensureLoggableError(error) },
      `Cannot get ${service ? 'service' : 'runtime'} configuration: ${error.message}`
    )
  }
}
