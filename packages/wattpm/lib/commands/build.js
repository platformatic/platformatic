import {
  ensureLoggableError,
  findRuntimeConfigurationFile,
  getRoot,
  logFatalError,
  parseArgs
} from '@platformatic/foundation'
import { create } from '@platformatic/runtime'
import { bold } from 'colorette'

export async function buildCommand (logger, args) {
  let runtime
  let configurationFile

  try {
    const {
      values: { config },
      positionals
    } = parseArgs(
      args,
      {
        config: {
          type: 'string',
          short: 'c'
        }
      },
      false
    )
    const root = getRoot(positionals)

    configurationFile = await findRuntimeConfigurationFile(logger, root, config)

    /* c8 ignore next 3 - Hard to test */
    if (!configurationFile) {
      return
    }

    try {
      runtime = await create(configurationFile)
      await runtime.init()
      /* c8 ignore next 4 - Hard to test */
    } catch (error) {
      logFatalError(logger, { err: ensureLoggableError(error) }, `Cannot load the runtime: ${error.message}`)
      return
    }

    // Gather informations for all services before starting
    const { services } = await runtime.getServices()

    for (const { id } of services) {
      const currentLogger = logger.child({ name: id })
      currentLogger.debug(`Building service ${bold(id)} ...`)

      try {
        await runtime.buildService(id)
      } catch (error) {
        if (error.code === 'PLT_BASIC_NON_ZERO_EXIT_CODE') {
          logFatalError(currentLogger, `Building service "${id}" has failed with exit code ${error.exitCode}.`)
          /* c8 ignore next 6 */
        } else {
          logFatalError(
            currentLogger,
            { err: ensureLoggableError(error) },
            `Building service "${id}" has throw an exception: ${error.message}`
          )
          /* c8 ignore next 3 - Mistakenly reported as uncovered by C8 */
        }

        return
      }
    }

    logger.done('All services have been built.')
  } finally {
    await runtime?.close?.(true)
  }
}

export const help = {
  build: {
    usage: 'build [root]',
    description: 'Builds all services of an application',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-c, --config <config>',
        description: 'Name of the configuration file to use (the default is to autodetect it)'
      }
    ]
  }
}
