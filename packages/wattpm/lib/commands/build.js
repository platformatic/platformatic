import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { parse } from 'dotenv'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  buildRuntime,
  findConfigurationFile,
  getPackageArgs,
  getPackageManager,
  getRoot,
  loadConfigurationFile,
  overrideFatal,
  parseArgs
} from '../utils.js'

// This function will not perform the command if the .npmrc file contains the 'dry-run' flag - This is useful in tests
async function executeCommand (root, ...args) {
  const npmrc = resolve(root, '.npmrc')
  if (existsSync(npmrc)) {
    try {
      const env = parse(await readFile(npmrc, 'utf8'))

      if (env['dry-run'] === 'true') {
        return
      }
      /* c8 ignore next 5 */
    } catch (error) {
      // No-op
    }
  }

  /* c8 ignore next */
  return execa(...args)
}

export async function installDependencies (logger, root, services, production, packageManager) {
  if (typeof services === 'string') {
    const config = await loadConfigurationFile(logger, services)
    services = config.services
  }

  if (!packageManager) {
    packageManager = getPackageManager(root)
  }

  const args = getPackageArgs(packageManager, production)

  // Install dependencies of the application
  try {
    logger.info(
      `Installing ${production ? 'production ' : ''}dependencies for the application using ${packageManager} ...`
    )

    await executeCommand(root, packageManager, args, { cwd: root, stdio: 'inherit' })
    /* c8 ignore next 3 */
  } catch (error) {
    logger.fatal({ error: ensureLoggableError(error) }, 'Unable to install dependencies of the application.')
  }

  for (const service of services) {
    /* c8 ignore next */
    const servicePackageManager = service.packageManager ?? getPackageManager(service.path) ?? packageManager
    const servicePackageArgs = getPackageArgs(servicePackageManager, production)

    try {
      logger.info(
        `Installing ${production ? 'production ' : ''}dependencies for the service ${bold(service.id)} using ${servicePackageManager} ...`
      )

      await executeCommand(root, servicePackageManager, servicePackageArgs, {
        cwd: resolve(root, service.path),
        stdio: 'inherit'
      })
      /* c8 ignore next 6 */
    } catch (error) {
      logger.fatal(
        { error: ensureLoggableError(error) },
        `Unable to install dependencies of the service ${bold(service.id)}.`
      )
    }
  }
}

export async function buildCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)
  /* c8 ignore next */
  const root = getRoot(positionals)

  const configurationFile = await findConfigurationFile(logger, root)

  const runtime = await buildRuntime(logger, configurationFile)
  // Gather informations for all services before starting
  const { services } = await runtime.getServices()

  for (const { id } of services) {
    const currentLogger = logger.child({ name: id })
    currentLogger.debug(`Building service ${bold(id)} ...`)
    overrideFatal(currentLogger)

    try {
      await runtime.buildService(id)
    } catch (error) {
      if (error.code === 'PLT_BASIC_NON_ZERO_EXIT_CODE') {
        currentLogger.error(`Building service "${id}" has failed with exit code ${error.exitCode}.`)
        /* c8 ignore next 6 */
      } else {
        currentLogger.error(
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

export async function installCommand (logger, args) {
  const {
    values: { production, 'package-manager': packageManager },
    positionals
  } = parseArgs(
    args,
    {
      production: {
        type: 'boolean',
        short: 'p',
        default: false
      },
      'package-manager': {
        type: 'string',
        short: 'P'
      }
    },
    false
  )

  /* c8 ignore next */
  const root = getRoot(positionals)
  const configurationFile = await findConfigurationFile(logger, root)

  await installDependencies(logger, root, configurationFile, production, packageManager)
  logger.done('All services have been resolved.')
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
    ]
  },
  install: {
    usage: 'install [root]',
    description: 'Install all dependencies of an application and its services',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-p --production',
        description: 'Only install production dependencies'
      },
      {
        usage: '-P, --package-manager <executable>',
        description: 'Use an alternative package manager (the default is to autodetect it)'
      }
    ]
  }
}
