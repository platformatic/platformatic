import { getMatchingRuntime, RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import pinoPretty from 'pino-pretty'
import split2 from 'split2'

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

  let application
  const client = new RuntimeApiClient()
  try {
    const [runtime, positionals] = await getMatchingRuntime(client, allPositionals)
    application = positionals[0]

    const logsStream = client.getRuntimeLiveLogsStream(runtime.pid)

    function onClose () {
      logsStream.destroy()
      client.close()
    }

    process.on('SIGINT', onClose)
    process.on('SIGTERM', onClose)

    for await (const line of logsStream.pipe(split2())) {
      const parsed = JSON.parse(line)

      if (parsed.level < minimumLevel || (application && parsed.name !== application)) {
        continue
      }

      output.write(line + '\n')
    }
    /* c8 ignore next - Mistakenly reported as uncovered by C8 */
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
      /* c8 ignore next 8 */
    } else {
      return logFatalError(
        logger,
        { error: ensureLoggableError(error) },
        `Cannot stream ${application ? 'application' : 'runtime'} logs: ${error.message}`
      )
    }
  } finally {
    await client.close()
  }
}

export const help = {
  logs: {
    usage: 'logs [id] [application]',
    description: 'Streams logs from a running application or application',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      },
      {
        name: 'application',
        description: 'The application name'
      }
    ],
    footer: 'If application is not specified, the command will stream logs from all applications.'
  }
}
