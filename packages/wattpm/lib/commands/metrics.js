import { getMatchingRuntime, RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { bold } from 'colorette'

export async function metricsCommand (logger, args) {
  const client = new RuntimeApiClient()
  try {
    const { values, positionals } = parseArgs(args, { format: { type: 'string', short: 'f', default: 'json' } }, false)

    const [runtime] = await getMatchingRuntime(client, positionals)
    const metrics = await client.getRuntimeMetrics(runtime.pid, { format: values.format })
    const result = values.format === 'text' ? metrics : JSON.stringify(metrics, null, 2)
    console.log(result)

    logger.done(`Runtime ${bold(runtime.packageName)} have been stopped.`)
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
      /* c8 ignore next 3 - Hard to test */
    } else {
      return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot reload the runtime: ${error.message}`)
    }
  } finally {
    client.close()
  }
}

export const help = {
  metrics: {
    usage: 'metrics [id]',
    description: 'Return metrics from a running application',
    options: [
      {
        usage: '-f, --format',
        description: 'Define metrics format, it should be either text or json (default is json)'
      }
    ],
    args: [
      {
        name: 'id',
        description:
          'The process ID of the application (it can be omitted only if there is a single application running)'
      }
    ],
    footer: 'If process id is not specified, the command will return metrics from main application running.'
  }
}
