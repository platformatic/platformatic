import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { resolve } from 'node:path'
import { buildRuntime, findConfigurationFile, parseArgs } from '../utils.js'

export async function buildCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)
  const root = resolve(process.cwd(), positionals[0] ?? '')

  const configurationFile = await findConfigurationFile(logger, root)

  const runtime = await buildRuntime(logger, resolve(root, configurationFile))

  // Gather informations for all services before starting
  const { services } = await runtime.getServices()

  for (const { id } of services) {
    logger.info(`Building service ${bold(id)} ...`)

    try {
      await runtime.buildService(id)
    } catch (error) {
      if (error.code === 'PLT_BASIC_NON_ZERO_EXIT_CODE') {
        logger.error(`Building service "${id}" has failed with exit code ${error.exitCode}.`)
      } else {
        logger.error(
          { err: ensureLoggableError(error) },
          `Building service "${id}" has throw an exception: ${error.message}`
        )
      }

      process.exit(1)
    }
  }

  logger.done('All services have been built.')
  await runtime.close(false, true)
}
