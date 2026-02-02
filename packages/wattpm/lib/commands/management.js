import { getMatchingRuntime, RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { bold, reset } from 'colorette'
import { sep } from 'node:path'
import { getBorderCharacters, table } from 'table'
import { getSocket } from '../utils.js'

const ONE_DAY = 3600 * 24
const ONE_HOUR = 3600
const ONE_MINUTE = 60

const tableConfig = {
  /* c8 ignore next */
  border: getBorderCharacters(process.stdout.isTTY ? 'norc' : 'ramac'),
  drawHorizontalLine (index, rowCount) {
    return index < 2 || index === rowCount
  }
}

function formatPath (path) {
  let tokens = path.split(sep)

  if (tokens.length > 3) {
    tokens = tokens.slice(-3)
  }

  tokens.unshift('...')
  return tokens.join(sep)
}

/* c8 ignore next 30 */
function formatDuration (duration) {
  let result = ''

  if (duration === 0) {
    return 'now'
  }

  if (duration >= ONE_DAY) {
    const days = Math.floor(duration / ONE_DAY)
    duration = duration % ONE_DAY
    result += `${days}d `
  }

  if (duration >= ONE_HOUR) {
    const hours = Math.floor(duration / ONE_HOUR)
    duration = duration % ONE_HOUR
    result += `${hours}h `
  }

  if (duration >= ONE_MINUTE) {
    const minutes = Math.floor(duration / ONE_MINUTE)
    duration = duration % ONE_MINUTE
    result += `${minutes}m `
  }

  if (duration > 0) {
    result += `${duration}s`
  }

  return result.trim()
}

export async function psCommand (logger) {
  const client = new RuntimeApiClient(getSocket())
  try {
    const runtimes = await client.getRuntimes()

    if (runtimes.length === 0) {
      logger.warn('No runtimes found.')
      return
    }

    const rows = runtimes.map(runtime => {
      const { pid, packageName, platformaticVersion, uptimeSeconds, url, projectDir } = runtime

      return [pid, packageName, platformaticVersion, formatDuration(uptimeSeconds), url, formatPath(projectDir)]
    })
    console.log(
      '\n' +
        table(
          [[bold('PID'), bold('Name'), bold('Version'), bold('Uptime'), bold('URL'), bold('Directory')], ...rows],
          tableConfig
        )
    )
    /* c8 ignore next 3 - Hard to test */
  } catch (error) {
    return logFatalError(logger, { error: ensureLoggableError(error) }, `Cannot list runtime: ${error.message}`)
  } finally {
    await client.close()
  }
}

export async function applicationsCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)
  const client = new RuntimeApiClient(getSocket())

  try {
    const [runtime] = await getMatchingRuntime(client, positionals)
    const { production, applications } = await client.getRuntimeApplications(runtime.pid)

    const headers = production
      ? [bold('Name'), bold('Workers'), bold('Type'), bold('Entrypoint')]
      : [bold('Name'), bold('Type'), bold('Entrypoint')]

    const rows = applications.map(runtime => {
      const { id, workers, type, entrypoint } = runtime

      /* c8 ignore next */
      return [id, workers, type, entrypoint ? 'Yes' : 'No'].filter(t => t)
    })

    console.log('\n' + table([headers, ...rows], tableConfig))
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
      /* c8 ignore next 7 - Hard to test */
    } else {
      return logFatalError(
        logger,
        { error: ensureLoggableError(error) },
        `Cannot list runtime applications: ${error.message}`
      )
    }
  } finally {
    await client.close()
  }
}

export async function envCommand (logger, args) {
  const { values, positionals: allPositionals } = parseArgs(args, { table: { type: 'boolean', short: 't' } }, false)

  let application
  const client = new RuntimeApiClient(getSocket())
  try {
    const [runtime, positionals] = await getMatchingRuntime(client, allPositionals)
    application = positionals[0]

    const env = application
      ? await client.getRuntimeApplicationEnv(runtime.pid, application)
      : await client.getRuntimeEnv(runtime.pid)

    if (values.table) {
      console.log(
        '\n' +
          table(
            [[bold('Name'), bold('Value')], ...Object.entries(env).map(([k, v]) => [bold(k), reset(v)])],
            tableConfig
          )
      )
    } else {
      console.log(
        Object.entries(env)
          .map(([k, v]) => `${bold(k)}=${reset(v)}`)
          .join('\n')
      )
    }
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.code === 'PLT_CTR_APPLICATION_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching application.')
      /* c8 ignore next 7 */
    } else {
      return logFatalError(
        logger,
        { error: ensureLoggableError(error) },
        `Cannot get ${application ? 'application' : 'runtime'} environment variables: ${error.message}`
      )
    }
  } finally {
    await client.close()
  }
}

export async function configCommand (logger, args) {
  const { positionals: allPositionals } = parseArgs(args, {}, false)

  let application
  const client = new RuntimeApiClient(getSocket())
  try {
    const [runtime, positionals] = await getMatchingRuntime(client, allPositionals)
    application = positionals[0]

    const config = application
      ? await client.getRuntimeApplicationConfig(runtime.pid, application)
      : await client.getRuntimeConfig(runtime.pid)

    console.log(JSON.stringify(config, null, 2))
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching runtime.')
    } else if (error.code === 'PLT_CTR_APPLICATION_NOT_FOUND') {
      return logFatalError(logger, 'Cannot find a matching application.')
      /* c8 ignore next 7 */
    } else {
      return logFatalError(
        logger,
        { error: ensureLoggableError(error) },
        `Cannot get ${application ? 'application' : 'runtime'} configuration: ${error.message}`
      )
    }
  } finally {
    await client.close()
  }
}

export const help = {
  ps: {
    usage: 'ps',
    description: 'Lists all running applications'
  },
  applications: {
    usage: 'applications [id]',
    description: 'Lists all applications',
    args: [
      {
        name: 'id',
        description:
          'The process ID or the name of the application (it can be omitted only if there is a single application running)'
      }
    ]
  },
  env: {
    usage: 'env [id] [application]',
    description: 'Show the environment variables of a running Watt server or one of its applications',
    options: [
      {
        usage: '-t, --table',
        description: 'Show variables in tabular way'
      }
    ],
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
    ]
  },
  config: {
    usage: 'config [id] [application]',
    description: 'Show the configuration of a running Watt server or one of its applications',
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
    ]
  }
}
