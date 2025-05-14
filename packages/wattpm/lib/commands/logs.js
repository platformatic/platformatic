import { RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError } from '@platformatic/utils'
import pinoPretty from 'pino-pretty'
import split2 from 'split2'
import { getMatchingRuntime, parseArgs } from '../utils.js'

export async function logsCommand (logger, args) {
  const { values, positionals: allPositionals } = parseArgs(
    args,
    {
      level: { type: 'string', short: 'l', default: 'info' },
      pretty: { type: 'boolean', short: 'p', default: false }
    },
    false
  )

  const minimumLevel = logger.levels.values[values.level]
  /* c8 ignore next */
  const output = values.pretty ? pinoPretty({ colorize: true }) : process.stdout

  let service
  try {
    const client = new RuntimeApiClient()
    const [runtime, positionals] = await getMatchingRuntime(client, allPositionals)
    service = positionals[0]

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
    /* c8 ignore next - Mistakenly reported as uncovered by C8 */
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      logger.fatal('Cannot find a matching runtime.')
      /* c8 ignore next 6 */
    } else {
      logger.fatal(
        { error: ensureLoggableError(error) },
        `Cannot stream ${service ? 'service' : 'runtime'} logs: ${error.message}`
      )
    }
  }
}

export const help = {
  logs: {
    usage: 'logs [id] [service]',
    description: 'Streams logs from a running application or service',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'service',
        description: 'The service name'
      }
    ],
    footer: 'If service is not specified, the command will stream logs from all services.'
  }
}
