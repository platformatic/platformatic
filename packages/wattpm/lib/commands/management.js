import { RuntimeApiClient } from '@platformatic/control'
import { ensureLoggableError } from '@platformatic/utils'
import { bold, reset } from 'colorette'
import { sep } from 'node:path'
import { getBorderCharacters, table } from 'table'
import { getMatchingRuntimeArgs, parseArgs } from '../utils.js'

const ONE_DAY = 3600 * 24
const ONE_HOUR = 3600
const ONE_MINUTE = 60

const tableConfig = {
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

function formatDuration (duration) {
  let result = ''

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

export async function psCommand (logger, args) {
  try {
    const client = new RuntimeApiClient()
    const runtimes = await client.getRuntimes()
    await client.close()

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
  } catch (error) {
    logger.fatal({ error: ensureLoggableError(error) }, `Cannot list runtime: ${error.message}`)
  }
}

export async function servicesCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  try {
    const client = new RuntimeApiClient()
    const runtime = await client.getMatchingRuntime(getMatchingRuntimeArgs(positionals))
    const services = await client.getRuntimeServices(runtime.pid)
    await client.close()

    const rows = services.services.map(runtime => {
      const { id, type, entrypoint } = runtime

      return [id, type, entrypoint ? 'Yes' : 'No']
    })

    console.log('\n' + table([[bold('Name'), bold('Type'), bold('Entrypoint')], ...rows], tableConfig))
  } catch (error) {
    if (error.code === 'PLT_CTR_RUNTIME_NOT_FOUND') {
      logger.fatal('Cannot find a matching runtime.')
    }

    logger.fatal({ error: ensureLoggableError(error) }, `Cannot list runtime services: ${error.message}`)
  }
}

export async function envCommand (logger, args) {
  const { values, positionals } = parseArgs(args, { table: { type: 'boolean', short: 't' } }, false)
  const service = positionals[1]

  try {
    const client = new RuntimeApiClient()
    const runtime = await client.getMatchingRuntime(getMatchingRuntimeArgs(positionals))

    const env = service
      ? await client.getRuntimeServiceEnv(runtime.pid, service)
      : await client.getRuntimeEnv(runtime.pid)
    await client.close()

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
      logger.fatal('Cannot find a matching runtime.')
    } else if (error.code === 'PLT_CTR_SERVICE_NOT_FOUND') {
      logger.fatal('Cannot find a matching service.')
    }

    logger.fatal(
      { error: ensureLoggableError(error) },
      `Cannot get ${service ? 'service' : 'runtime'} environment variables: ${error.message}`
    )
  }
}

export async function configCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)
  const service = positionals[1]

  try {
    const client = new RuntimeApiClient()
    const runtime = await client.getMatchingRuntime(getMatchingRuntimeArgs(positionals))

    const config = service
      ? await client.getRuntimeServiceConfig(runtime.pid, service)
      : await client.getRuntimeConfig(runtime.pid)
    await client.close()

    console.log(JSON.stringify(config, null, 2))
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
